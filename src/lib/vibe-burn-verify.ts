// Server-only. Shared verification for every $VIBE burn endpoint.
//
// Written once so the vouch and streak-protect routes cannot drift apart and a
// security fix lands in one place. Returns a discriminated union rather than
// throwing, so callers map failures straight onto HTTP statuses.
//
// 404 and 503 are deliberately distinguished from 400: the client retries those
// (the transaction may not have propagated yet, or an RPC hiccuped) and
// surfaces everything else immediately.

import { CHAIN_CONFIGS, isSolanaChain } from "@/lib/chains-config";
import { solanaRpcUrl } from "@/lib/solana-rpc";
import {
  expectedTokenAmount,
  extractMemos,
  fetchVibeUsdCached,
} from "@/lib/promotion-pricing";
import {
  burnedAtLeast,
  netTokenDelta,
  parseBurnMemo,
  sameBurnAction,
  type BurnAction,
} from "@/lib/vibe-burn";
import { VIBE_MINT } from "@/lib/vibe-config";

export type BurnVerifyResult =
  | { ok: true; burned: bigint; vibeUsd: number }
  | { ok: false; status: number; error: string };

type TokenBalanceEntry = {
  owner?: string | null;
  mint: string;
  uiTokenAmount?: { amount?: string | null } | null;
};

type SolanaTx = {
  meta?: {
    err?: unknown;
    preTokenBalances?: TokenBalanceEntry[];
    postTokenBalances?: TokenBalanceEntry[];
  } | null;
  transaction?: {
    message?: {
      instructions?: Array<{ program?: string; programId?: string; parsed?: unknown }>;
    };
  };
};

/**
 * Verify that `signature` is a confirmed Solana transaction which burned at
 * least `usd` worth of $VIBE and whose memo matches `expectedAction` exactly.
 *
 * Matching the FULL action — not just the target — is what stops user A
 * claiming user B's already-broadcast burn.
 */
export async function verifyBurnTransaction(
  signature: string,
  expectedAction: BurnAction,
  usd: number,
): Promise<BurnVerifyResult> {
  const solana = CHAIN_CONFIGS.solana;
  if (!isSolanaChain(solana)) {
    return { ok: false, status: 500, error: "Solana is not configured." };
  }

  // 1. Fetch the transaction. 'confirmed' rather than 'finalized' so
  //    verification works seconds after the wallet returns; confirmed-depth
  //    reorgs are vanishingly rare on Solana.
  let txJson: { error?: unknown; result?: SolanaTx };
  try {
    const res = await fetch(solanaRpcUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTransaction",
        params: [
          signature,
          {
            commitment: "confirmed",
            maxSupportedTransactionVersion: 0,
            encoding: "jsonParsed",
          },
        ],
      }),
    });
    if (!res.ok) {
      return {
        ok: false,
        status: 503,
        error: "Couldn't reach the Solana network. Please retry.",
      };
    }
    txJson = await res.json();
  } catch {
    return {
      ok: false,
      status: 503,
      error: "Couldn't reach the Solana network. Please retry.",
    };
  }

  if (txJson?.error) {
    return { ok: false, status: 503, error: "Solana RPC error. Please retry." };
  }
  const tx = txJson?.result;
  if (!tx) {
    return {
      ok: false,
      status: 404,
      error: "Transaction not found or not confirmed yet.",
    };
  }
  if (tx.meta?.err) {
    return { ok: false, status: 400, error: "That transaction failed on-chain." };
  }

  // 2. The signed memo must name this actor and this target.
  const memos = extractMemos(tx.transaction?.message?.instructions ?? []);
  const matched = memos
    .map(parseBurnMemo)
    .some((a) => a != null && sameBurnAction(a, expectedAction));
  if (!matched) {
    return { ok: false, status: 400, error: "That burn isn't bound to this action." };
  }

  // 3. Expected amount. Fails CLOSED — never grant against an unknown price.
  let vibeUsd: number;
  try {
    vibeUsd = await fetchVibeUsdCached();
  } catch {
    return {
      ok: false,
      status: 503,
      error: "Couldn't price $VIBE right now. Please retry.",
    };
  }
  const expected = expectedTokenAmount(
    BigInt(Math.round(usd * 1e6)),
    "vibe",
    vibeUsd,
    solana.vibeDecimals,
  );

  // 4. The conservation invariant. A transfer of the same amount fails here,
  //    by design — only destruction counts.
  const pre = tx.meta?.preTokenBalances ?? [];
  const post = tx.meta?.postTokenBalances ?? [];
  if (!burnedAtLeast(pre, post, VIBE_MINT, expected)) {
    return {
      ok: false,
      status: 400,
      error: "That transaction didn't burn enough $VIBE.",
    };
  }

  return { ok: true, burned: -netTokenDelta(pre, post, VIBE_MINT), vibeUsd };
}
