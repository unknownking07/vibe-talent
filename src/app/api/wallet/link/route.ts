import { NextRequest, NextResponse } from "next/server";
import { ed25519 } from "@noble/curves/ed25519";
import bs58 from "bs58";
import { Redis } from "@upstash/redis";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stagingOnlyResponse } from "@/lib/staging";
import {
  nonceKey,
  nonceMessage,
  SOLANA_ADDRESS_RE,
  localConsumeNonce,
  isLocalWalletNonceStoreEnabled,
} from "@/lib/wallet-link";

// Binds a Solana wallet to the signed-in account after verifying an ed25519
// signature over a server-issued nonce.

export async function POST(req: NextRequest) {
  const gate = stagingOnlyResponse();
  if (gate) return gate;

  try {
    const authClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
    }

    const { address, signature } = (await req.json()) ?? {};
    if (typeof address !== "string" || !SOLANA_ADDRESS_RE.test(address)) {
      return NextResponse.json({ error: "Invalid wallet address." }, { status: 400 });
    }
    if (typeof signature !== "string" || signature.length < 64) {
      return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
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
      return NextResponse.json({ error: "Couldn't link that wallet." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, address });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

/** Unlink the current wallet. */
export async function DELETE() {
  const gate = stagingOnlyResponse();
  if (gate) return gate;

  const authClient = await createServerSupabaseClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const sb = createAdminClient();
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
    return NextResponse.json({ error: "Couldn't unlink that wallet." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
