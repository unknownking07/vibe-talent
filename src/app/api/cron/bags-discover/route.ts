import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  bagsConfigured,
  fetchTokenCreators,
  fetchLaunchFeed,
} from "@/lib/bags";
import { fetchTokenMarkets } from "@/lib/token-market";

/**
 * Cron job: discover Bags launches we have no wallet for.
 *
 * bags-sync answers "what did our builders launch". This answers the opposite
 * question, "who is launching on Bags that we do not know yet", so a launcher
 * can find their own coin sitting unclaimed and has a reason to link a wallet.
 *
 * The pairing that matters: a row written here has user_id NULL, and NOTHING
 * here may set it from anything a launcher controls. It is set only when the
 * creator wallet Bags reports already belongs to a signature-verified profile,
 * which means the builder proved that wallet before this job ever ran.
 *
 * Protected by CRON_SECRET.
 */

/**
 * How many stored launches get their market data refreshed in one run.
 *
 * This used to be a per-run budget of twenty, spent in feed order, and it was
 * the reason the board rendered blank: the feed leads with the newest launches,
 * which are exactly the ones with no pool to price yet, and every launch past
 * the twentieth was written with null market columns that overwrote whatever an
 * earlier run had found. Thirty mints per multi lookup makes a full refresh
 * cost tens of requests rather than hundreds, so the budget is gone and the cap
 * is only a guard rail. Rows are taken stalest-first, so a table that ever
 * outgrows the cap still cycles instead of starving its tail.
 */
const MARKET_REFRESH_LIMIT = 1500;

type MarketRefresh = {
  /** Rows selected for refresh. */
  considered: number;
  /** Rows GeckoTerminal answered for, priced or not. */
  refreshed: number;
  /** Of those, how many it actually indexes. */
  priced: number;
};

/**
 * Re-price every stored launch, including the ones this run did not discover.
 *
 * Discovery only ever sees the current Bags feed, so a launch that scrolls off
 * it would keep whatever price it had on the day it appeared. Pricing the table
 * rather than the feed is what lets a row that missed out — or that had its
 * columns blanked by the old budget — recover on the next run without a
 * one-off backfill.
 */
async function refreshMarketData(
  sb: ReturnType<typeof createAdminClient>,
): Promise<MarketRefresh> {
  const empty: MarketRefresh = { considered: 0, refreshed: 0, priced: 0 };

  const { data, error } = await sb
    .from("bags_launches")
    .select("token_mint, creator_wallet")
    // Never-priced rows first, then the stalest. At the current table size
    // every row makes the cut on every run.
    .order("market_synced_at", { ascending: true, nullsFirst: true })
    .limit(MARKET_REFRESH_LIMIT);

  if (error) {
    console.error("bags-discover: market refresh select failed:", error.message);
    return empty;
  }

  const rows = (data ?? []) as { token_mint: string; creator_wallet: string }[];
  if (rows.length === 0) return empty;

  const { markets, answered } = await fetchTokenMarkets(
    rows.map((r) => r.token_mint),
  );

  const now = new Date().toISOString();
  // Only rows GeckoTerminal answered for. A chunk that failed leaves its mints
  // untouched, so an outage costs a refresh rather than wiping real prices.
  const updates = rows
    .filter((r) => answered.has(r.token_mint))
    .map((r) => {
      const market = markets.get(r.token_mint) ?? null;
      return {
        token_mint: r.token_mint,
        // Carried so the upsert has every NOT NULL column it would need if a
        // row vanished between the select and the write. Same value either way.
        creator_wallet: r.creator_wallet,
        // Null here is a finding, not a gap: GeckoTerminal was asked and does
        // not index this mint, which is normal before a launch trades.
        token_image_url: market?.imageUrl ?? null,
        fdv_usd: market?.fdvUsd ?? null,
        volume_24h_usd: market?.volume24hUsd ?? null,
        market_synced_at: now,
      };
    });

  if (updates.length === 0) return { ...empty, considered: rows.length };

  // Columns absent from the payload are left alone by the conflict update, so
  // this cannot disturb user_id, the Bags identity fields or last_verified_at.
  const { error: writeError } = await sb
    .from("bags_launches")
    .upsert(updates, { onConflict: "token_mint" });

  if (writeError) {
    console.error("bags-discover: market refresh write failed:", writeError.message);
    return { ...empty, considered: rows.length };
  }

  return {
    considered: rows.length,
    refreshed: updates.length,
    priced: updates.filter((u) => u.fdv_usd !== null).length,
  };
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  // Fail closed: this writes the table backing a public credibility claim.
  if (!cronSecret && process.env.NODE_ENV === "production") {
    console.error("CRON_SECRET is not configured");
    return NextResponse.json(
      { error: "Cron secret not configured" },
      { status: 500 },
    );
  }
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (!bagsConfigured()) {
    return NextResponse.json({ skipped: "BAGS_API_KEY not configured" });
  }

  const sb = createAdminClient();

  // Every wallet a builder has actually proved. A launch is only ever attributed
  // through this map, never through a handle or anything else self-reported.
  const { data: verified, error: verifiedError } = await sb
    .from("users")
    .select("id, solana_wallet")
    .not("solana_wallet", "is", null)
    .not("solana_wallet_verified_at", "is", null);

  if (verifiedError) {
    console.error(
      "bags-discover: failed to load verified wallets:",
      verifiedError.message,
    );
    return NextResponse.json(
      { error: "Failed to load wallets" },
      { status: 500 },
    );
  }

  const walletToUser = new Map<string, string>();
  for (const row of (verified ?? []) as {
    id: string;
    solana_wallet: string;
  }[]) {
    walletToUser.set(row.solana_wallet, row.id);
  }

  let seen = 0;
  let written = 0;
  let claimed = 0;
  let unattributable = 0;
  let lookupFailed = 0;

  // The feed can carry the same mint more than once. Without this each repeat
  // costs another Bags call and another upsert, and inflates every number this
  // route reports.
  const processed = new Set<string>();

  const feed = await fetchLaunchFeed();
  if (!feed) {
    console.error("bags-discover: launch feed unavailable");
    return NextResponse.json(
      { error: "Launch feed unavailable" },
      { status: 502 },
    );
  }

  for (const launch of feed) {
    if (processed.has(launch.tokenMint)) continue;
    processed.add(launch.tokenMint);
    seen += 1;

    const creators = await fetchTokenCreators(launch.tokenMint);
    // Null covers both "Bags could not answer" and "Bags rejected the mint",
    // which are very different runs. Counted apart so a broken pass cannot
    // report as a healthy one that simply found nothing.
    if (!creators) {
      lookupFailed += 1;
      console.warn(`bags-discover: no creator answer for ${launch.tokenMint}`);
      continue;
    }

    // A launch Bags cannot name a creator for tells a reader nothing.
    const creator = creators.find(
      (c) => c.isCreator === true && typeof c.wallet === "string" && c.wallet,
    );
    if (!creator) {
      unattributable += 1;
      continue;
    }

    const wallet = creator.wallet as string;
    const userId = walletToUser.get(wallet);

    // Names and tickers are whatever the launcher minted. Stored raw and
    // sanitised where they are rendered, so the record stays faithful and a
    // change to the sanitiser needs no re-sync.
    const row: Record<string, unknown> = {
      token_mint: launch.tokenMint,
      creator_wallet: wallet,
      twitter_username:
        typeof creator.twitterUsername === "string"
          ? creator.twitterUsername
          : null,
      bags_username:
        typeof creator.bagsUsername === "string" ? creator.bagsUsername : null,
      royalty_bps:
        typeof creator.royaltyBps === "number" ? creator.royaltyBps : 0,
      token_name: launch.name,
      token_symbol: launch.symbol,
      last_verified_at: new Date().toISOString(),
    };

    // No market columns here, deliberately. Discovery answers "who launched
    // this"; pricing is a separate pass over the whole table. Writing both from
    // one loop is what let an unpriced launch blank a priced one.

    // user_id is written ONLY when a proved wallet matches. Omitting the key
    // leaves an existing claim untouched, so a discovery pass can never unclaim
    // a launch a builder already verified.
    if (userId) row.user_id = userId;

    const { error: upsertError } = await sb
      .from("bags_launches")
      .upsert(row, { onConflict: "token_mint" });

    if (upsertError) {
      console.error(
        `bags-discover: upsert failed for ${launch.tokenMint}:`,
        upsertError.message,
      );
      continue;
    }

    written += 1;
    if (userId) claimed += 1;
  }

  const market = await refreshMarketData(sb);

  return NextResponse.json({
    seen,
    written,
    claimed,
    unattributable,
    lookupFailed,
    market,
  });
}
