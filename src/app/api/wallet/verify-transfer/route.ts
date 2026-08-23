import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  checkRateLimit,
  walletLinkLimiter,
  walletWatchLimiter,
} from "@/lib/rate-limit";
import {
  localConsumeNonce,
  localPeekNonce,
  localStoreNonce,
  isLocalWalletNonceStoreEnabled,
} from "@/lib/wallet-link";
import {
  transferNonceKey,
  transferMemo,
  randomChallengeLamports,
  verifyTransferProof,
  findTransferProof,
  TRANSFER_NONCE_TTL_SECONDS,
  type TransferChallenge,
} from "@/lib/wallet-transfer-proof";
import { CHAIN_CONFIGS, isSolanaChain } from "@/lib/chains-config";

// Wallet ownership proof for builders who will not connect a wallet to a site.
//
// GET issues a challenge memo; POST takes the signature of a transaction
// carrying it and links the wallet that signed. See lib/wallet-transfer-proof
// for why this is memo-bound and self-directed, and why signing a message
// remains the recommended route.

/**
 * Read the stored challenge, consuming it when `consume` is set.
 *
 * The watched flow polls, so it must be able to look without spending. Only the
 * final step consumes, and the caller MUST check what consumption returned:
 * GETDEL is the lock, and a null there means another request already spent this
 * challenge.
 */
async function readNonce(
  key: string,
  consume: boolean,
): Promise<string | null> {
  if (isLocalWalletNonceStoreEnabled()) {
    return consume ? localConsumeNonce(key) : localPeekNonce(key);
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const redis = new Redis({ url, token });
  return consume
    ? await redis.getdel<string>(key)
    : await redis.get<string>(key);
}

/** Amounts currently spoken for, when running without Redis. */
const localReservedAmounts = new Map<number, number>();

/** How many draws before giving up on finding a free amount. */
const RESERVE_ATTEMPTS = 12;

/**
 * Claim a challenge amount nobody else is waiting on.
 *
 * The reservation, not the size of the range, is what makes an amount identify
 * one challenge. It expires with the challenge, so an abandoned attempt frees
 * its number instead of burning it forever.
 */
async function reserveAmount(): Promise<number | null> {
  const ttlMs = TRANSFER_NONCE_TTL_SECONDS * 1000;

  if (isLocalWalletNonceStoreEnabled()) {
    const now = Date.now();
    for (const [amount, expiresAt] of localReservedAmounts) {
      if (expiresAt <= now) localReservedAmounts.delete(amount);
    }
    for (let i = 0; i < RESERVE_ATTEMPTS; i++) {
      const candidate = randomChallengeLamports();
      if (!localReservedAmounts.has(candidate)) {
        localReservedAmounts.set(candidate, now + ttlMs);
        return candidate;
      }
    }
    return null;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const redis = new Redis({ url, token });
  for (let i = 0; i < RESERVE_ATTEMPTS; i++) {
    const candidate = randomChallengeLamports();
    try {
      // NX makes the claim atomic: only one caller can take a number.
      const claimed = await redis.set(`wallet-amount:${candidate}`, "1", {
        nx: true,
        ex: TRANSFER_NONCE_TTL_SECONDS,
      });
      if (claimed) return candidate;
    } catch {
      return null;
    }
  }
  return null;
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

  // The challenge names the account in its memo, so it is built where the
  // account is known. Falling back to the id keeps it issuable for someone who
  // has not picked a username yet.
  const { data: profile } = await authClient
    .from("users")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();
  const handle = (
    profile as { username?: string | null } | null
  )?.username?.trim();

  // Reserve an amount no other open challenge holds. Two live challenges
  // sharing a number would let whichever account polls first take the other's
  // transfer, so uniqueness has to be claimed, not merely likely.
  const lamports = await reserveAmount();
  if (lamports === null) {
    return NextResponse.json(
      {
        error:
          "Wallet verification is busy right now. Please try again shortly.",
      },
      { status: 503 },
    );
  }

  const challenge: TransferChallenge = {
    lamports,
    memo: transferMemo(crypto.randomUUID(), handle || user.id.slice(0, 8)),
    issuedAt: Math.floor(Date.now() / 1000),
  };
  const stored = JSON.stringify(challenge);
  const key = transferNonceKey(user.id);

  if (isLocalWalletNonceStoreEnabled()) {
    localStoreNonce(key, stored, TRANSFER_NONCE_TTL_SECONDS);
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
      await redis.set(key, stored, { ex: TRANSFER_NONCE_TTL_SECONDS });
    } catch {
      console.error("Wallet transfer nonce: Redis write failed");
      return NextResponse.json(
        { error: "Wallet verification is unavailable right now." },
        { status: 503 },
      );
    }
  }

  const solana = CHAIN_CONFIGS.solana;

  return NextResponse.json(
    {
      lamports: challenge.lamports,
      destination: isSolanaChain(solana) ? solana.receivingWallet : null,
      memo: challenge.memo,
      expiresInSeconds: TRANSFER_NONCE_TTL_SECONDS,
      // Stated by the server so the UI cannot quietly describe a different
      // action from the one being verified.
      instructions:
        "From the wallet you want to prove, send exactly this many lamports to " +
        "the address shown. We watch for it and verify you automatically. If " +
        "your wallet can attach a memo, add the one below as well; most cannot, " +
        "and the amount alone is enough.",
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

    // Polling and submitting are different shapes of traffic, so they draw on
    // different budgets: a watched flow asks repeatedly by design.
    const { signature, address } = (await req.json()) ?? {};
    const hasSignature =
      typeof signature === "string" && Boolean(signature.trim());
    const hasAddress = typeof address === "string" && Boolean(address.trim());

    // Keyed off the branch that actually runs below. Picking on `hasAddress`
    // let a signature submission carry any non-empty address along and draw on
    // the far larger polling budget.
    const { success } = await checkRateLimit(
      hasSignature ? walletLinkLimiter : walletWatchLimiter,
      `transfer-verify:${user.id}`,
    );
    if (!success) {
      return NextResponse.json(
        { error: "Too many attempts. Please wait a moment and try again." },
        { status: 429 },
      );
    }

    // `address` is the watched flow: the builder names the wallet and we look
    // for the proof. `signature` is the manual fallback for anyone whose
    // transaction the RPC will not surface.
    //
    // Naming an address grants nothing. The proof is still a signed transaction
    // carrying a challenge only this account was issued.
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

    // `pending` is the serialised challenge, stored at issue time.
    let challenge: TransferChallenge;
    try {
      challenge = JSON.parse(pending) as TransferChallenge;
    } catch {
      return NextResponse.json(
        { error: "That verification expired. Please start again." },
        { status: 400 },
      );
    }
    const result = hasSignature
      ? await verifyTransferProof(signature.trim(), challenge)
      : await findTransferProof(address.trim(), challenge);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }

    // Proof accepted, so the challenge is spent. This is also the lock: GETDEL
    // returns the value only to the first caller, so two concurrent requests
    // that both verified the same transaction cannot both go on to link. Only
    // reached on success — a 404 above returns with the challenge intact, which
    // is what lets the client poll.
    const consumed = await readNonce(key, true);
    if (!consumed) {
      return NextResponse.json(
        { error: "That verification was already used. Please start again." },
        { status: 409 },
      );
    }

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
