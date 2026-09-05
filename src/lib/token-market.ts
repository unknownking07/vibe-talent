// Market data for a Solana token, from GeckoTerminal's free public API.
//
// WHY GECKOTERMINAL: Bags tokens trade on a Bags bonding curve and are not
// routable on Jupiter, so the usual Solana price sources return nothing for
// them. GeckoTerminal indexes the curve pools directly, needs no key, and is
// already the price source this codebase uses for $VIBE.
//
// This is enrichment, never a source of truth. The verification claim on a
// /bags page comes from the database; price, chart and artwork come from here
// and every call fails soft, so an outage costs a card its numbers rather than
// taking the page down.

const GECKO_API_BASE = "https://api.geckoterminal.com/api/v2";
const NETWORK = "solana";

/** GeckoTerminal is not on our critical path; give up quickly. */
const REQUEST_TIMEOUT_MS = 8_000;

/**
 * Cache window for market data, in seconds. Matches the /bags ISR window: there
 * is no point holding a fresher price than the page that renders it.
 */
const MARKET_REVALIDATE_S = 300;

export type TokenMarket = {
  mint: string;
  name: string | null;
  symbol: string | null;
  imageUrl: string | null;
  priceUsd: number | null;
  fdvUsd: number | null;
  volume24hUsd: number | null;
  /** Bonding-curve progress, 0-100, for tokens that have not graduated. */
  graduationPct: number | null;
  graduated: boolean;
  /** Pool used for the chart; null when the token has no indexed pool. */
  poolAddress: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Parse the numeric strings GeckoTerminal returns, rejecting junk and NaN. */
function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function geckoGet(path: string): Promise<unknown | null> {
  try {
    const res = await fetch(`${GECKO_API_BASE}${path}`, {
      headers: {
        Accept: "application/json",
        // GeckoTerminal is a free, keyless API and rejects some default client
        // agents outright. Identifying the caller is both the fix and the
        // courtesy owed to an endpoint we are not paying for.
        "User-Agent": "vibetalent/1.0 (+https://www.vibetalent.work)",
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      next: { revalidate: MARKET_REVALIDATE_S },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    // Timeout, network failure, or malformed JSON. All mean the same thing here.
    return null;
  }
}

/**
 * Turn one GeckoTerminal token object into a TokenMarket.
 *
 * Shared by the single and the multi lookup so both read the same fields the
 * same way: a shape change upstream breaks one parser instead of two.
 */
function parseTokenMarket(
  entry: unknown,
  requestedMint: string | null,
): TokenMarket | null {
  if (!isRecord(entry)) return null;

  const attrs = entry.attributes;
  if (!isRecord(attrs)) return null;

  // The multi lookup returns tokens in no guaranteed order and omits any it
  // does not index, so the mint has to come off the payload rather than off a
  // caller's position in the request.
  const address = typeof attrs.address === "string" ? attrs.address : null;
  const mint = requestedMint ?? address;
  if (!mint) return null;

  const launchpad = isRecord(attrs.launchpad_details)
    ? attrs.launchpad_details
    : null;

  // The first related pool is the deepest one, which is the pool worth charting.
  let poolAddress: string | null = null;
  const relationships = entry.relationships;
  if (isRecord(relationships) && isRecord(relationships.top_pools)) {
    const pools = relationships.top_pools.data;
    if (
      Array.isArray(pools) &&
      isRecord(pools[0]) &&
      typeof pools[0].id === "string"
    ) {
      // Ids arrive network-prefixed ("solana_<address>").
      poolAddress = pools[0].id.replace(`${NETWORK}_`, "");
    }
  }

  return {
    mint,
    name: typeof attrs.name === "string" ? attrs.name : null,
    symbol: typeof attrs.symbol === "string" ? attrs.symbol : null,
    imageUrl: typeof attrs.image_url === "string" ? attrs.image_url : null,
    priceUsd: toNumber(attrs.price_usd),
    fdvUsd: toNumber(attrs.fdv_usd),
    volume24hUsd: isRecord(attrs.volume_usd)
      ? toNumber(attrs.volume_usd.h24)
      : null,
    graduationPct: launchpad ? toNumber(launchpad.graduation_percentage) : null,
    graduated: launchpad?.completed === true,
    poolAddress,
  };
}

/**
 * Name, artwork, price and pool for one mint.
 *
 * Returns null when GeckoTerminal has never indexed the token, which is normal
 * for a launch that has not traded yet.
 */
export async function fetchTokenMarket(
  mint: string,
): Promise<TokenMarket | null> {
  const body = await geckoGet(
    `/networks/${NETWORK}/tokens/${encodeURIComponent(mint)}`,
  );
  if (!isRecord(body)) return null;
  return parseTokenMarket(body.data, mint);
}

/** GeckoTerminal accepts at most 30 addresses per multi lookup. */
const MULTI_LOOKUP_CHUNK = 30;

export type TokenMarketBatch = {
  /** Market data for every requested mint GeckoTerminal indexes. */
  markets: Map<string, TokenMarket>;
  /**
   * The mints GeckoTerminal actually answered for.
   *
   * A mint listed here but absent from `markets` is genuinely unindexed, which
   * is a fact worth storing. A mint in neither belongs to a chunk whose request
   * failed, and nothing may be concluded about it — the same "could not ask"
   * versus "asked, and there is genuinely nothing" split the Bags client keeps.
   */
  answered: Set<string>;
};

/**
 * Market data for many mints, thirty per request.
 *
 * The single lookup costs one request per mint, which is why the discovery cron
 * could only afford to price a handful of launches per run. This prices a whole
 * table of them in a couple of dozen requests.
 */
export async function fetchTokenMarkets(
  mints: readonly string[],
): Promise<TokenMarketBatch> {
  const markets = new Map<string, TokenMarket>();
  const answered = new Set<string>();

  for (let i = 0; i < mints.length; i += MULTI_LOOKUP_CHUNK) {
    const chunk = mints.slice(i, i + MULTI_LOOKUP_CHUNK);
    const body = await geckoGet(
      `/networks/${NETWORK}/tokens/multi/${chunk
        .map(encodeURIComponent)
        .join(",")}?include=top_pools`,
    );
    // A failed chunk leaves its mints out of `answered`, so a caller keeps what
    // it already had for them instead of blanking the lot on an outage.
    if (!isRecord(body) || !Array.isArray(body.data)) continue;

    for (const mint of chunk) answered.add(mint);
    for (const entry of body.data) {
      const market = parseTokenMarket(entry, null);
      if (market) markets.set(market.mint, market);
    }
  }

  return { markets, answered };
}

/**
 * Daily closing prices for a pool, oldest first.
 *
 * GeckoTerminal returns candles newest-first as [timestamp, o, h, l, c, volume];
 * a chart reads left to right, so they are reversed here rather than in the view.
 */
export async function fetchDailyCloses(
  pool: string,
  days = 30,
): Promise<number[]> {
  const body = await geckoGet(
    `/networks/${NETWORK}/pools/${encodeURIComponent(pool)}/ohlcv/day?aggregate=1&limit=${days}`,
  );
  if (!isRecord(body) || !isRecord(body.data)) return [];

  const attrs = body.data.attributes;
  if (!isRecord(attrs) || !Array.isArray(attrs.ohlcv_list)) return [];

  const closes: number[] = [];
  for (const candle of attrs.ohlcv_list) {
    if (!Array.isArray(candle)) continue;
    const close = toNumber(candle[4]);
    if (close !== null) closes.push(close);
  }
  return closes.reverse();
}

/** Percentage change across a series, or null when there is nothing to compare. */
export function changePct(closes: number[]): number | null {
  if (closes.length < 2) return null;
  const first = closes[0]!;
  const last = closes[closes.length - 1]!;
  if (first === 0) return null;
  return ((last - first) / first) * 100;
}

/** One launch as GeckoTerminal lists it under the Bags dex. */
export type BagsPoolListing = {
  mint: string;
  name: string | null;
  symbol: string | null;
  imageUrl: string | null;
  fdvUsd: number | null;
  volume24hUsd: number | null;
  poolCreatedAt: string | null;
};

/**
 * Bags launches, busiest first.
 *
 * This is the only way to enumerate launches we have no wallet for: the Bags
 * public API is keyed by wallet and by mint, and exposes no listing endpoint.
 *
 * It is a PARTIAL view and the board must say so. Bags runs its bonding curve
 * on Meteora, so a launch only appears under the `bags-fm` dex once it trades
 * there; $VIBE itself is still on `meteora-dbc`, which is shared with other
 * launchpads and so cannot be read as "Bags launches" without mislabelling
 * other platforms' tokens.
 *
 * `include=base_token` folds the name, ticker and artwork into the same
 * response, so a page of twenty launches costs one request rather than
 * twenty-one.
 */
export async function fetchBagsDexPools(page = 1): Promise<BagsPoolListing[]> {
  const body = await geckoGet(
    `/networks/${NETWORK}/dexes/bags-fm/pools?page=${page}&sort=h24_volume_usd_desc&include=base_token`,
  );
  if (!isRecord(body) || !Array.isArray(body.data)) return [];

  // Included token objects, keyed by mint, so each pool can find its own.
  const tokens = new Map<string, Record<string, unknown>>();
  if (Array.isArray(body.included)) {
    for (const entry of body.included) {
      if (!isRecord(entry) || entry.type !== "token") continue;
      const attrs = entry.attributes;
      if (!isRecord(attrs) || typeof attrs.address !== "string") continue;
      tokens.set(attrs.address, attrs);
    }
  }

  const listings: BagsPoolListing[] = [];
  for (const pool of body.data) {
    if (!isRecord(pool)) continue;

    const relationships = pool.relationships;
    if (!isRecord(relationships) || !isRecord(relationships.base_token))
      continue;
    const ref = relationships.base_token.data;
    if (!isRecord(ref) || typeof ref.id !== "string") continue;

    const mint = ref.id.replace(`${NETWORK}_`, "");
    if (!mint) continue;

    const attrs = isRecord(pool.attributes) ? pool.attributes : {};
    const token = tokens.get(mint);

    listings.push({
      mint,
      // Names and tickers here are attacker-controlled; callers must run them
      // through the display sanitiser before they reach a page.
      name: typeof token?.name === "string" ? token.name : null,
      symbol: typeof token?.symbol === "string" ? token.symbol : null,
      imageUrl: typeof token?.image_url === "string" ? token.image_url : null,
      fdvUsd: toNumber(attrs.fdv_usd),
      volume24hUsd: isRecord(attrs.volume_usd)
        ? toNumber(attrs.volume_usd.h24)
        : null,
      poolCreatedAt:
        typeof attrs.pool_created_at === "string"
          ? attrs.pool_created_at
          : null,
    });
  }

  return listings;
}

/**
 * A dollar amount, compact but not lied about.
 *
 * formatTokenCount rounds to whole units, which is right for supply and wrong
 * for money: it renders $12.50 as $13 and $0.40 as $0. Volume and FDV on the
 * board are frequently small enough for that to matter.
 */
export function formatUsdCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(2)}K`;
  if (value === 0) return "$0";
  return `$${value.toFixed(2)}`;
}
