import { NextRequest, NextResponse } from "next/server";
import { ed25519 } from "@noble/curves/ed25519";
import bs58 from "bs58";
import { Redis } from "@upstash/redis";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, walletLinkLimiter } from "@/lib/rate-limit";
import {
  nonceKey,
  nonceMessage,
  SOLANA_ADDRESS_RE,
  BASE58_SIGNATURE_RE,
  localConsumeNonce,
  isLocalWalletNonceStoreEnabled,
} from "@/lib/wallet-link";

// Binds a Solana wallet to the signed-in account after verifying an ed25519
// signature over a server-issued nonce.

/**
 * Point every cached Bags launch made by `wallet` at `userId`, or at nobody.
 *
 * WHY THIS EXISTS: bags_launches rows are written by a daily sync and keyed by
 * mint, so they outlive the wallet link that justified them. Without this, a
 * builder who links a wallet, collects verified launches, then unlinks keeps
 * being shown on /bags as the proven creator of coins made by a wallet they no
 * longer control — and the next person to prove that wallet would not take the
 * attribution over until the next sync. On a page whose entire claim is that
 * every row is backed by a signature held right now, that is the claim going
 * stale.
 *
 * Never allowed to fail the request it runs inside: the wallet link itself has
 * already succeeded or failed on its own merits, and the daily sync converges
 * on the same answer regardless.
 */
async function reattributeLaunches(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  wallet: string,
  userId: string | null,
  /**
   * Only rewrite rows currently attributed to this account. Without it a slow
   * unlink finishing after someone else has proved the same wallet would strip
   * the new owner's attribution, leaving the board showing an unclaimed launch
   * while a verified holder exists.
   */
  onlyCurrentlyAttributedTo?: string,
): Promise<void> {
  try {
    let q = sb
      .from("bags_launches")
      .update({ user_id: userId })
      .eq("creator_wallet", wallet);
    if (onlyCurrentlyAttributedTo)
      q = q.eq("user_id", onlyCurrentlyAttributedTo);
    const { error } = await q;
    if (error) {
      console.error(
        "Wallet link: failed to re-attribute Bags launches:",
        error.message,
      );
    }
  } catch (e) {
    console.error("Wallet link: failed to re-attribute Bags launches:", e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const authClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: "You must be signed in." },
        { status: 401 },
      );
    }

    const { success } = await checkRateLimit(
      walletLinkLimiter,
      `link:${user.id}`,
    );
    if (!success) {
      return NextResponse.json(
        { error: "Too many attempts. Please wait a moment and try again." },
        { status: 429 },
      );
    }

    const { address, signature } = (await req.json()) ?? {};
    if (typeof address !== "string" || !SOLANA_ADDRESS_RE.test(address)) {
      return NextResponse.json(
        { error: "Invalid wallet address." },
        { status: 400 },
      );
    }
    // A 64-byte ed25519 signature is 86-88 base58 characters. The old floor of
    // 64 read like a byte count and let obviously malformed input through to
    // the verifier; the verifier is still what decides, this just fails early.
    if (typeof signature !== "string" || !BASE58_SIGNATURE_RE.test(signature)) {
      return NextResponse.json(
        { error: "Invalid signature." },
        { status: 400 },
      );
    }

    const key = nonceKey(user.id);

    // Consume the nonce before verifying, so a failed attempt can't be retried
    // against the same challenge.
    let nonce: string | null;
    if (isLocalWalletNonceStoreEnabled()) {
      nonce = localConsumeNonce(key);
    } else {
      const url = process.env.UPSTASH_REDIS_REST_URL;
      const token = process.env.UPSTASH_REDIS_REST_TOKEN;
      if (!url || !token) {
        return NextResponse.json(
          { error: "Wallet linking is unavailable right now." },
          { status: 503 },
        );
      }

      let redis: Redis;
      try {
        redis = new Redis({ url, token });
      } catch {
        return NextResponse.json(
          { error: "Wallet linking is unavailable right now." },
          { status: 503 },
        );
      }

      try {
        // GETDEL makes nonce consumption atomic, so concurrent link attempts
        // cannot both verify the same single-use challenge.
        nonce = await redis.getdel<string>(key);
      } catch {
        console.error("Wallet link: Redis nonce consume failed");
        return NextResponse.json(
          { error: "Wallet linking is unavailable right now." },
          { status: 503 },
        );
      }
    }

    if (!nonce) {
      return NextResponse.json(
        { error: "That link request expired. Please try again." },
        { status: 400 },
      );
    }

    let valid = false;
    try {
      valid = ed25519.verify(
        bs58.decode(signature),
        new TextEncoder().encode(nonceMessage(nonce)),
        bs58.decode(address),
      );
    } catch {
      // Malformed base58 in either field — treat as a failed proof, not a 500.
      valid = false;
    }
    if (!valid) {
      return NextResponse.json(
        { error: "That signature doesn't match the wallet." },
        { status: 400 },
      );
    }

    const sb = createAdminClient();

    // One wallet, one account. A unique index enforces this, but checking first
    // turns a constraint violation into a message the user can act on.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: taken } = await (sb as any)
      .from("users")
      .select("id")
      .eq("solana_wallet", address)
      .neq("id", user.id)
      .maybeSingle();
    if (taken) {
      return NextResponse.json(
        { error: "That wallet is already linked to another account." },
        { status: 409 },
      );
    }

    // Written with the admin client: these columns are deliberately outside the
    // client UPDATE grant, or holder tiers would be self-assignable.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (sb as any)
      .from("users")
      .update({
        solana_wallet: address,
        solana_wallet_verified_at: new Date().toISOString(),
        // Force a refresh on next read rather than trusting a stale balance
        // from whoever held this wallet before.
        vibe_balance: 0,
        vibe_balance_at: null,
      })
      .eq("id", user.id);

    if (error) {
      console.error("Failed to link wallet:", error);
      return NextResponse.json(
        { error: "Couldn't link that wallet." },
        { status: 500 },
      );
    }

    // The prover now owns this wallet's launches. Doing it here rather than
    // waiting for the nightly sync means /bags cannot show the previous holder
    // as the verified builder for up to a day after they lost the wallet.
    await reattributeLaunches(sb, address, user.id);

    return NextResponse.json({ ok: true, address });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

/** Unlink the current wallet. */
export async function DELETE() {
  const authClient = await createServerSupabaseClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "You must be signed in." },
      { status: 401 },
    );
  }

  const sb = createAdminClient();

  // Read the wallet before clearing it: afterwards there is nothing left to say
  // which launches were being claimed on the strength of it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: current, error: readError } = await (sb as any)
    .from("users")
    .select("solana_wallet")
    .eq("id", user.id)
    .maybeSingle();

  // Stop before clearing anything. Unlinking on a failed read would drop the
  // wallet while leaving its launches attributed to this account, which is the
  // one combination that leaves a false claim standing on /bags.
  if (readError) {
    console.error("Failed to read wallet before unlink:", readError);
    return NextResponse.json(
      { error: "Couldn't unlink that wallet." },
      { status: 500 },
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb as any)
    .from("users")
    .update({
      solana_wallet: null,
      solana_wallet_verified_at: null,
      vibe_balance: 0,
      vibe_balance_at: null,
    })
    .eq("id", user.id);

  if (error) {
    console.error("Failed to unlink wallet:", error);
    return NextResponse.json(
      { error: "Couldn't unlink that wallet." },
      { status: 500 },
    );
  }

  // Giving up the proof gives up the claim. The launches stay in the table as
  // unclaimed rows, which is exactly what they now are.
  const wallet = (current as { solana_wallet?: string | null } | null)
    ?.solana_wallet;
  if (wallet) await reattributeLaunches(sb, wallet, null, user.id);

  return NextResponse.json({ ok: true });
}
