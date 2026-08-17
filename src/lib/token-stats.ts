// Live $VIBE stats for the /token page.
//
// Unlike the payment path (which fails CLOSED so it never grants value against
// a stale price), this fails SOFT — /token is an informational page and should
// still render if an upstream is down.

import { fetchVibeUsdCached } from "@/lib/promotion-pricing";
import { CHAIN_CONFIGS, isSolanaChain } from "@/lib/chains-config";
import { solanaRpcUrl } from "@/lib/solana-rpc";
import { VIBE_MINT, VIBE_DECIMALS } from "@/lib/vibe-config";

export type TokenStats = {
  priceUsd: number | null;
  supply: number | null;
  marketCapUsd: number | null;
  /** Total $VIBE destroyed through vouches + streak protects, whole tokens. */
  burnedTotal: number;
  burnedUsd: number;
};

/** Circulating supply in whole tokens, via getTokenSupply. Null on failure. */
export async function fetchSupply(): Promise<number | null> {
  const solana = CHAIN_CONFIGS.solana;
  if (!isSolanaChain(solana)) return null;
  try {
    const res = await fetch(solanaRpcUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTokenSupply",
        params: [VIBE_MINT],
      }),
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const ui = json?.result?.value?.uiAmount;
    return typeof ui === "number" ? ui : null;
  } catch {
    return null;
  }
}

/** Convert base units to whole tokens. */
export function toWholeTokens(baseUnits: bigint): number {
  return Number(baseUnits) / 10 ** VIBE_DECIMALS;
}

/**
 * Assemble the page stats. `burnedBaseUnits` and `burnedUsd` come from the
 * database and are passed in, so this module stays free of Supabase coupling
 * and its pure parts stay testable.
 */
export async function getTokenStats(
  burnedBaseUnits: bigint,
  burnedUsd: number,
): Promise<TokenStats> {
  const [priceUsd, supply] = await Promise.all([
    fetchVibeUsdCached().catch(() => null),
    fetchSupply(),
  ]);

  return {
    priceUsd,
    supply,
    marketCapUsd: priceUsd != null && supply != null ? priceUsd * supply : null,
    burnedTotal: toWholeTokens(burnedBaseUnits),
    burnedUsd,
  };
}

/** Compact display for large token counts: 2,078,000 -> "2.08M". */
export function formatTokenCount(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

/**
 * Price with enough significant digits to be meaningful. $VIBE trades around
 * $0.0000024, so a fixed 2-4 decimal format would render it as "$0.00".
 */
export function formatTokenPrice(price: number): string {
  if (price >= 1) return `$${price.toFixed(2)}`;
  if (price >= 0.01) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(9)}`;
}
