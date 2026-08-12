// Reads a wallet's $VIBE balance from Solana and caches it on the user row.
//
// Cached because the public RPC is slow and rate-limited, and profile/dashboard
// renders must never depend on a live RPC round trip.

import { CHAIN_CONFIGS, isSolanaChain } from "@/lib/chains-config";
import { VIBE_MINT, VIBE_DECIMALS } from "@/lib/vibe-config";

const REFRESH_COOLDOWN_MS = 60_000;

type ParsedTokenAccount = {
  account?: {
    data?: { parsed?: { info?: { tokenAmount?: { amount?: string } } } };
  };
};

/**
 * Live $VIBE balance in base units for a wallet, or null if unreadable.
 *
 * Returns null rather than 0 on failure so callers can distinguish "holds
 * nothing" from "we couldn't check" — treating an RPC hiccup as a zero balance
 * would silently strip someone's holder tier.
 */
export async function fetchVibeBalance(wallet: string): Promise<bigint | null> {
  const solana = CHAIN_CONFIGS.solana;
  if (!isSolanaChain(solana)) return null;
  try {
    const res = await fetch(solana.rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTokenAccountsByOwner",
        params: [wallet, { mint: VIBE_MINT }, { encoding: "jsonParsed" }],
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (json?.error) return null;
    const accounts: ParsedTokenAccount[] = json?.result?.value ?? [];
    // A wallet can legitimately hold one mint across several token accounts.
    return accounts.reduce(
      (acc, a) =>
        acc + BigInt(a?.account?.data?.parsed?.info?.tokenAmount?.amount || "0"),
      BigInt(0),
    );
  } catch {
    return null;
  }
}

/** Has the cached balance aged out enough to justify another RPC call? */
export function isBalanceStale(balanceAt: string | null): boolean {
  if (!balanceAt) return true;
  const at = new Date(balanceAt).getTime();
  if (Number.isNaN(at)) return true;
  return Date.now() - at > REFRESH_COOLDOWN_MS;
}

/** Base units to whole tokens. */
export function toWholeVibe(baseUnits: bigint): number {
  return Number(baseUnits) / 10 ** VIBE_DECIMALS;
}

/** USD value of a base-unit balance at a given $VIBE price. */
export function balanceUsd(baseUnits: bigint, vibeUsd: number): number {
  return toWholeVibe(baseUnits) * vibeUsd;
}
