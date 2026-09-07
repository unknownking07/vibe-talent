// Turning a market-refresh answer into rows to write.
//
// WHY THIS IS NOT INLINE IN THE ROUTE: the refresh is the one path where data
// that came from outside decides what lands in bags_launches. The lookups run on
// the GitHub Actions runner (GeckoTerminal rate-limits Cloudflare's shared
// egress, so the Worker cannot do them), which means the numbers arrive over
// HTTP rather than being fetched in-process. What may and may not come from that
// payload is therefore a rule worth stating in one place and testing, rather
// than an implicit property of a request handler.
//
// The rule: the payload supplies numbers, and nothing else. Every identity in a
// written row is read back out of our own table first, so a refresh can neither
// invent a launch nor change whose launch it is.

import type { TokenMarket } from "@/lib/token-market";

/** A row as it exists before the refresh — our identity for it, not theirs. */
export type ExistingLaunch = {
  token_mint: string;
  creator_wallet: string;
};

/** Exactly the columns a refresh may write. */
export type MarketUpdate = {
  token_mint: string;
  creator_wallet: string;
  token_image_url: string | null;
  fdv_usd: number | null;
  volume_24h_usd: number | null;
  market_synced_at: string;
};

/**
 * The rows to upsert for one refresh.
 *
 * `answered` is what the runner actually got a response for. A mint in it but
 * absent from `markets` was asked about and is genuinely unindexed, so its null
 * is stored — that is a finding, not a gap. A mint in neither was never
 * successfully asked about and is left out entirely, so it keeps the price it
 * had and sorts to the front of the next run.
 *
 * A mint that is not already in `existing` produces nothing, whatever the
 * payload claimed about it.
 */
export function buildMarketUpdates(
  answered: ReadonlySet<string>,
  markets: ReadonlyMap<string, TokenMarket>,
  existing: readonly ExistingLaunch[],
  now: string,
): MarketUpdate[] {
  const updates: MarketUpdate[] = [];

  for (const row of existing) {
    if (!answered.has(row.token_mint)) continue;

    const market = markets.get(row.token_mint) ?? null;
    updates.push({
      token_mint: row.token_mint,
      // From our table, never from the payload.
      creator_wallet: row.creator_wallet,
      token_image_url: market?.imageUrl ?? null,
      fdv_usd: market?.fdvUsd ?? null,
      volume_24h_usd: market?.volume24hUsd ?? null,
      market_synced_at: now,
    });
  }

  return updates;
}
