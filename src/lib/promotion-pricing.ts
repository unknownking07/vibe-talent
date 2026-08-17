// Pricing + verification helpers for Solana / $VIBE featured-promotion payments.
//
// Pure helpers (expectedTokenAmount, passesSlippage, expiresAtFor,
// pickReceivedDelta, pickPriceFromPools) are unit-tested. The cached fetchers
// do network I/O (Base contract getPrices, GeckoTerminal $VIBE price) and run
// server-side only.

import { CHAIN_CONFIGS, isEVMChain, isSolanaChain } from "@/lib/chains-config";

export type PaymentToken = "usdc" | "vibe";

// Contract package_id → active duration. 4 (Annual) is treated as lifetime by
// the contract, so its promotion never expires (expires_at = null).
const PACKAGE_DURATION_DAYS: Record<number, number | null> = {
  0: 1, // Day
  1: 3, // 3-day (hidden)
  2: 7, // Week
  3: 30, // Month
  4: null, // Annual = Lifetime
};

export function isValidPackageId(packageId: number): boolean {
  return Object.prototype.hasOwnProperty.call(PACKAGE_DURATION_DAYS, packageId);
}

/** ISO expiry for a package, or null for lifetime. Caller must pass a valid id. */
export function expiresAtFor(packageId: number, nowMs: number): string | null {
  const days = PACKAGE_DURATION_DAYS[packageId];
  if (days == null) return null;
  return new Date(nowMs + days * 86_400_000).toISOString();
}

/**
 * Expected on-chain amount (base units) for a package price.
 * @param usdcBaseUnits package price from the contract (USDC, 6 decimals).
 * @param token         'usdc' (Solana USDC, 6dp) or 'vibe' (9dp).
 * @param vibeUsd       $VIBE price in USD (required for 'vibe').
 */
export function expectedTokenAmount(
  usdcBaseUnits: bigint,
  token: PaymentToken,
  vibeUsd: number,
  vibeDecimals = 9,
): bigint {
  if (token === "usdc") return usdcBaseUnits;
  if (!(vibeUsd > 0)) throw new Error("Invalid $VIBE price");
  const usdValue = Number(usdcBaseUnits) / 1e6; // dollars
  const vibeTokens = usdValue / vibeUsd; // whole $VIBE
  // Precision note: result can exceed Number.MAX_SAFE_INTEGER, but the error is
  // < 1 part in 1e15 — utterly negligible against the 90% slippage floor.
  return BigInt(Math.round(vibeTokens * 10 ** vibeDecimals));
}

/** Did the buyer pay at least `floorBps`/10000 of the expected amount? */
export function passesSlippage(paid: bigint, expected: bigint, floorBps = 9000): boolean {
  return paid * BigInt(10000) >= expected * BigInt(floorBps);
}

type TokenBalance = {
  owner?: string | null;
  mint: string;
  uiTokenAmount?: { amount?: string | null } | null;
};

/**
 * Net base-unit delta received by `receivingOwner` for `mint`, from a parsed
 * transaction's pre/post token balances. Handles the ATA-created-this-tx case
 * (no pre entry → counted as 0). Proves mint + destination + amount in one shot.
 */
export function pickReceivedDelta(
  pre: TokenBalance[],
  post: TokenBalance[],
  receivingOwner: string,
  mint: string,
): bigint {
  const sum = (arr: TokenBalance[]) =>
    (arr || [])
      .filter((b) => b.owner === receivingOwner && b.mint === mint)
      .reduce((acc, b) => acc + BigInt(b.uiTokenAmount?.amount || "0"), BigInt(0));
  return sum(post) - sum(pre);
}

const MEMO_PROGRAM_IDS = new Set([
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr", // memo v2
  "Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo", // memo v1
]);

type ParsedInstruction = { program?: string; programId?: string; parsed?: unknown };

/**
 * Memo strings from a parsed transaction's top-level instructions. Used to bind
 * a Solana payment to a specific project: the payer stamps the project_id into
 * the memo inside their signed tx, so it can't be forged onto someone else's
 * payment (prevents claiming another user's transfer for your own project).
 */
export function extractMemos(instructions: ParsedInstruction[]): string[] {
  return (instructions || [])
    .filter(
      (ix) =>
        ix.program === "spl-memo" || (ix.programId != null && MEMO_PROGRAM_IDS.has(ix.programId)),
    )
    .map((ix) => (typeof ix.parsed === "string" ? ix.parsed : ""))
    .filter((m) => m.length > 0);
}

// ── Cached network fetchers (server-side only) ──

let pricesCache: { at: number; prices: bigint[] } | null = null;

/**
 * Package prices (USDC base units) from the Base contract's getPrices(), cached
 * 60s. THROWS on RPC / decoding failure — this is a payment path, so it fails
 * closed rather than quoting/granting against stale fallback prices that could
 * undercharge if the admin has changed on-chain prices since. Callers should
 * surface a 503.
 */
export async function fetchContractPricesCached(): Promise<bigint[]> {
  const now = Date.now();
  if (pricesCache && now - pricesCache.at < 60_000) return pricesCache.prices;
  const base = CHAIN_CONFIGS.base;
  if (!isEVMChain(base)) throw new Error("Base chain is not configured");
  const res = await fetch(base.rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{ to: base.contractAddr, data: "0xbd9a548b" }, "latest"],
    }),
  });
  if (!res.ok) throw new Error("Base RPC request failed");
  const json = await res.json();
  const result: unknown = json?.result;
  if (typeof result !== "string") throw new Error("Invalid getPrices() response");
  const data = result.startsWith("0x") ? result.slice(2) : result;
  if (data.length < 5 * 64) throw new Error("Truncated getPrices() response");
  const prices: bigint[] = [];
  for (let i = 0; i < 5; i++) prices.push(BigInt("0x" + data.slice(i * 64, i * 64 + 64)));
  pricesCache = { at: now, prices };
  return prices;
}

let vibeCache: { at: number; price: number } | null = null;

/**
 * Safely extracts a positive finite $VIBE price from the GeckoTerminal simple
 * token-price endpoint response. Navigates the nested shape with explicit
 * `unknown` narrowing — no optional chaining through `unknown` — and reads
 * exactly `token_prices[mint]`. Returns null for any malformed or non-positive
 * payload so the caller can fall through to the pools endpoint.
 */
export function extractSimplePrice(response: unknown, mint: string): number | null {
  if (typeof response !== "object" || response === null) return null;
  const data = (response as Record<string, unknown>).data;
  if (typeof data !== "object" || data === null) return null;
  const attributes = (data as Record<string, unknown>).attributes;
  if (typeof attributes !== "object" || attributes === null) return null;
  const tokenPrices = (attributes as Record<string, unknown>).token_prices;
  if (typeof tokenPrices !== "object" || tokenPrices === null) return null;
  const raw = (tokenPrices as Record<string, unknown>)[mint];
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  if (typeof raw === "string" && raw.trim().length === 0) return null;
  const p = Number(raw);
  if (!Number.isFinite(p) || p <= 0) return null;
  return p;
}

/**
 * Coerces a raw `unknown` price/reserve value into a non-negative finite number
 * when it is a number or a non-empty numeric string. Empty/whitespace strings,
 * booleans, null, malformed objects, NaN and Infinity all return null.
 */
function toNonNegativeFinite(raw: unknown): number | null {
  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || raw < 0) return null;
    return raw;
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed.length === 0) return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return null;
    return n;
  }
  return null;
}

/**
 * Extracts the safest positive USD price from a GeckoTerminal pools response.
 *
 * Scans `data[]` for pools whose base_token or quote_token exactly matches
 * `solana_${mint}`. For each match, reads the corresponding price_usd field.
 * Among valid positive finite candidates, picks the one from the pool with the
 * highest reserve_in_usd (best liquidity → most reliable price).
 *
 * Returns null when no valid candidate exists — caller should fall through to
 * a fail-closed throw rather than silently using a hardcoded value.
 */
export function pickPriceFromPools(poolJson: unknown, mint: string): number | null {
  if (
    typeof poolJson !== "object" ||
    poolJson === null ||
    !Array.isArray((poolJson as Record<string, unknown>).data)
  ) {
    return null;
  }

  const data = (poolJson as Record<string, unknown>).data as unknown[];
  const targetId = `solana_${mint}`;

  let bestPrice: number | null = null;
  let bestReserve = -1;

  for (const item of data) {
    if (typeof item !== "object" || item === null) continue;
    const itemRec = item as Record<string, unknown>;
    const attrs = itemRec.attributes;
    if (typeof attrs !== "object" || attrs === null) continue;

    const rels = itemRec.relationships;
    if (typeof rels !== "object" || rels === null) continue;

    const baseRel = (rels as Record<string, unknown>).base_token;
    const quoteRel = (rels as Record<string, unknown>).quote_token;

    let matchedField: "base" | "quote" | null = null;

    if (
      typeof baseRel === "object" &&
      baseRel !== null &&
      typeof (baseRel as Record<string, unknown>).data === "object" &&
      (baseRel as Record<string, unknown>).data !== null &&
      ((baseRel as Record<string, unknown>).data as Record<string, unknown>).id === targetId
    ) {
      matchedField = "base";
    } else if (
      typeof quoteRel === "object" &&
      quoteRel !== null &&
      typeof (quoteRel as Record<string, unknown>).data === "object" &&
      (quoteRel as Record<string, unknown>).data !== null &&
      ((quoteRel as Record<string, unknown>).data as Record<string, unknown>).id === targetId
    ) {
      matchedField = "quote";
    }

    if (!matchedField) continue;

    const reserve = toNonNegativeFinite((attrs as Record<string, unknown>).reserve_in_usd);
    if (reserve === null) continue;

    const priceField = matchedField === "base" ? "base_token_price_usd" : "quote_token_price_usd";
    const priceRaw = (attrs as Record<string, unknown>)[priceField];
    if (typeof priceRaw !== "string" && typeof priceRaw !== "number") continue;
    const price = Number(priceRaw);
    if (!Number.isFinite(price) || price <= 0) continue;

    if (reserve > bestReserve) {
      bestReserve = reserve;
      bestPrice = price;
    }
  }

  return bestPrice;
}

/** $VIBE price in USD via GeckoTerminal, cached 60s. Throws if unavailable. */
export async function fetchVibeUsdCached(): Promise<number> {
  const now = Date.now();
  if (vibeCache && now - vibeCache.at < 60_000) return vibeCache.price;
  const solana = CHAIN_CONFIGS.solana;
  const mint = isSolanaChain(solana) ? solana.vibeMint : "";
  const encodedMint = encodeURIComponent(mint);

  // Primary: GeckoTerminal simple token-price endpoint.
  let price: number | null = null;
  try {
    const res = await fetch(
      `https://api.geckoterminal.com/api/v2/simple/networks/solana/token_price/${encodedMint}`,
      { headers: { Accept: "application/json" } },
    );
    if (res.ok) {
      const json: unknown = await res.json();
      price = extractSimplePrice(json, mint);
    }
  } catch {
    // Fall through to the pools endpoint.
  }

  // Fallback: GeckoTerminal pools endpoint — useful when simple-price returns
  // null for low-liquidity or newly-listed tokens.
  if (price === null) {
    try {
      const res = await fetch(
        `https://api.geckoterminal.com/api/v2/networks/solana/tokens/${encodedMint}/pools?page=1`,
        { headers: { Accept: "application/json" } },
      );
      if (res.ok) {
        const json: unknown = await res.json();
        const p = pickPriceFromPools(json, mint);
        if (p !== null) price = p;
      }
    } catch {
      // Fall through to throw below.
    }
  }

  if (price === null) throw new Error("Could not resolve $VIBE price");
  vibeCache = { at: now, price };
  return price;
}
