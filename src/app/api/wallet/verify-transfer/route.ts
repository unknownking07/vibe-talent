import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, walletLinkLimiter } from "@/lib/rate-limit";
import {
  localConsumeNonce,
  localStoreNonce,
  isLocalWalletNonceStoreEnabled,
} from "@/lib/wallet-link";
import {
  transferNonceKey,
  transferMemo,
  verifyTransferProof,
  findTransferProof,
  TRANSFER_NONCE_TTL_SECONDS,
} from "@/lib/wallet-transfer-proof";

// Wallet ownership proof for builders who will not connect a wallet to a site.
//
// GET issues a challenge memo; POST takes the signature of a transaction
// carrying it and links the wallet that signed. See lib/wallet-transfer-proof
// for why this is memo-bound and self-directed, and why signing a message
// remains the recommended route.

/** Read the challenge for this user, consuming it when `consume` is set. */
async function readNonce(
  key: string,
  consume: boolean,
): Promise<string | null> {
  if (isLocalWalletNonceStoreEnabled()) {
    return consume ? localConsumeNonce(key) : null;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const redis = new Redis({ url, token });
  // GETDEL keeps consumption atomic, so two concurrent submissions cannot both
  // satisfy one challenge.
  return consume
    ? await redis.getdel<string>(key)
    : await redis.get<string>(key);
}

export async function GET() {
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
    `transfer-nonce:${user.id}`,
  );
  if (!success) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait a moment and try again." },
      { status: 429 },
    );
  }

  const nonce = crypto.randomUUID();
  const key = transferNonceKey(user.id);

  if (isLocalWalletNonceStoreEnabled()) {
    localStoreNonce(key, nonce);
  } else {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
      // Fail closed, exactly as the signing path does: without somewhere to
      // keep the challenge we cannot make it single-use.
      return NextResponse.json(
        { error: "Wallet verification is unavailable right now." },
        { status: 503 },
      );
    }
    try {
      const redis = new Redis({ url, token });
      await redis.set(key, nonce, { ex: TRANSFER_NONCE_TTL_SECONDS });
    } catch {
      console.error("Wallet transfer nonce: Redis write failed");
      return NextResponse.json(
        { error: "Wallet verification is unavailable right now." },
        { status: 503 },
      );
    }
  }

  return NextResponse.json(
    {
      memo: transferMemo(nonce),
      expiresInSeconds: TRANSFER_NONCE_TTL_SECONDS,
      // Stated by the server so the UI cannot quietly describe a different
      // action from the one being verified.
      instructions:
        "Send any amount to your own wallet from the wallet you want to prove, " +
        "with this exact memo attached. Then paste the transaction signature here. " +
        "Nothing is sent to VibeTalent and no approval is granted.",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
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
      `transfer-verify:${user.id}`,
    );
    if (!success) {
      return NextResponse.json(
        { error: "Too many attempts. Please wait a moment and try again." },
        { status: 429 },
      );
    }

    // Two ways in. `address` is the watched flow: the builder names the wallet
    // and we look for the proof ourselves. `signature` is the manual fallback
    // for anyone whose transaction the RPC will not surface.
    //
    // Naming an address grants nothing. The proof is still a signed transaction
    // carrying a challenge only this account was issued, so pointing us at a
    // stranger's wallet finds nothing.
    const { signature, address } = (await req.json()) ?? {};
    const hasSignature =
      typeof signature === "string" && Boolean(signature.trim());
    const hasAddress = typeof address === "string" && Boolean(address.trim());
    if (!hasSignature && !hasAddress) {
      return NextResponse.json(
        {
          error:
            "Send either your wallet address or the transaction signature.",
        },
        { status: 400 },
      );
    }

    const key = transferNonceKey(user.id);

    // Read WITHOUT consuming: a transaction that has not propagated yet returns
    // 404, and burning the challenge on that would make the builder rebroadcast
    // a transaction they already paid for.
    const pending = await readNonce(key, false);
    if (!pending) {
      return NextResponse.json(
        { error: "That verification expired. Please start again." },
        { status: 400 },
      );
    }

    const expectedMemo = transferMemo(pending);
    const result = hasSignature
      ? await verifyTransferProof(signature.trim(), expectedMemo)
      : await findTransferProof(address.trim(), expectedMemo);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }

    // Proof accepted, so the challenge is spent. Consumed before the write, so
    // a failure below cannot leave a reusable challenge behind. Note this is
    // only reached on success: a 404 above returns with the challenge intact,
    // which is what lets the client poll.
    await readNonce(key, true);

    const wallet = result.wallet;
    const sb = createAdminClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: taken } = await (sb as any)
      .from("users")
      .select("id")
      .eq("solana_wallet", wallet)
      .neq("id", user.id)
      .maybeSingle();
    if (taken) {
      return NextResponse.json(
        { error: "That wallet is already linked to another account." },
        { status: 409 },
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (sb as any)
      .from("users")
      .update({
        solana_wallet: wallet,
        solana_wallet_verified_at: new Date().toISOString(),
        vibe_balance: 0,
        vibe_balance_at: null,
      })
      .eq("id", user.id);

    if (error) {
      console.error("Failed to link wallet by transfer proof:", error);
      return NextResponse.json(
        { error: "Couldn't link that wallet." },
        { status: 500 },
      );
    }

    // Same as the signing path: the prover now owns this wallet's launches.
    try {
      await sb
        .from("bags_launches")
        .update({ user_id: user.id })
        .eq("creator_wallet", wallet);
    } catch (e) {
      console.error("Transfer proof: failed to re-attribute Bags launches:", e);
    }

    return NextResponse.json({ ok: true, address: wallet });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
