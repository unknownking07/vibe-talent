// Pricing + verification helpers for Solana / $VIBE featured-promotion payments.
//
// Pure helpers (expectedTokenAmount, passesSlippage, expiresAtFor,
// pickReceivedDelta) are unit-tested. The cached fetchers do network I/O
// (Base contract getPrices, GeckoTerminal $VIBE price) and run server-side only.

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

const FALLBACK_PRICES_USDC: bigint[] = [
  BigInt(2_000_000), // 0 Day    $2
  BigInt(5_000_000), // 1 3-day  $5 (hidden)
  BigInt(10_000_000), // 2 Week   $10
  BigInt(29_000_000), // 3 Month  $29
  BigInt(199_000_000), // 4 Annual $199
];

let pricesCache: { at: number; prices: bigint[] } | null = null;

/** Package prices (USDC base units) from the Base contract's getPrices(), cached 60s. */
export async function fetchContractPricesCached(): Promise<bigint[]> {
  const now = Date.now();
  if (pricesCache && now - pricesCache.at < 60_000) return pricesCache.prices;
  const base = CHAIN_CONFIGS.base;
  if (!isEVMChain(base)) return FALLBACK_PRICES_USDC;
  try {
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
    const json = await res.json();
    const result: unknown = json?.result;
    if (typeof result !== "string") return FALLBACK_PRICES_USDC;
    const data = result.startsWith("0x") ? result.slice(2) : result;
    if (data.length < 5 * 64) return FALLBACK_PRICES_USDC;
    const prices: bigint[] = [];
    for (let i = 0; i < 5; i++) prices.push(BigInt("0x" + data.slice(i * 64, i * 64 + 64)));
    pricesCache = { at: now, prices };
    return prices;
  } catch {
    return FALLBACK_PRICES_USDC;
  }
}

let vibeCache: { at: number; price: number } | null = null;

/** $VIBE price in USD via GeckoTerminal, cached 60s. Throws if unavailable. */
export async function fetchVibeUsdCached(): Promise<number> {
  const now = Date.now();
  if (vibeCache && now - vibeCache.at < 60_000) return vibeCache.price;
  const solana = CHAIN_CONFIGS.solana;
  const mint = isSolanaChain(solana) ? solana.vibeMint : "";
  const res = await fetch(
    `https://api.geckoterminal.com/api/v2/simple/networks/solana/token_price/${mint}`,
    { headers: { Accept: "application/json" } },
  );
  if (!res.ok) throw new Error("GeckoTerminal request failed");
  const json = await res.json();
  const priceStr: unknown = json?.data?.attributes?.token_prices?.[mint];
  const price = Number(priceStr);
  if (!(price > 0)) throw new Error("Could not resolve $VIBE price");
  vibeCache = { at: now, price };
  return price;
}
