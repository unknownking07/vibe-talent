// Server-only client for the Bags public API (https://public-api-v2.bags.fm).
//
// WHY THIS EXISTS: VibeTalent knows which GitHub-verified builder owns a Solana
// wallet, because linking one requires an ed25519 signature over a server-issued
// nonce. Bags knows which wallets launched which tokens. Neither side can join
// those alone, and the join is the interesting part: it lets a Bags launch carry
// a builder's real shipping history instead of being an anonymous wallet.
//
// SERVER-ONLY. The key travels in the x-api-key header; it must never reach the
// browser bundle. Import this from route handlers, crons and server components
// only — never from a "use client" module.
//
// Every call FAILS SOFT and returns null. Bags being down must never break a
// profile page: the builder's own reputation data is the primary content and
// their launches are enrichment on top of it.

const BAGS_API_BASE = "https://public-api-v2.bags.fm/api/v1";

/** How long to wait before giving up on Bags. Their API is not on our critical path. */
const REQUEST_TIMEOUT_MS = 8_000;

/** Solana base58 public key. Same shape the wallet-link flow validates against. */
const SOLANA_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/**
 * Is a Bags key configured?
 *
 * Read at call time, not module scope: on Workers the environment is bound per
 * request, so a module-level read can run before the value exists and would
 * then cache that miss for the life of the isolate.
 */
export function bagsConfigured(): boolean {
  return Boolean(process.env.BAGS_API_KEY?.trim());
}

/** Narrow an unknown value to a plain object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * GET a Bags endpoint and return the unwrapped `response` payload.
 *
 * Bags wraps everything as `{ success, response }` and uses `success: false`
 * for application-level failures alongside a 200, so the flag is checked
 * explicitly rather than trusting the status code.
 */
async function bagsGet(
  path: string,
  params: Record<string, string>,
): Promise<unknown | null> {
  const apiKey = process.env.BAGS_API_KEY?.trim();
  if (!apiKey) return null;

  const url = new URL(`${BAGS_API_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "x-api-key": apiKey, Accept: "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    // Network failure or timeout. Nothing here is worth surfacing to a user.
    return null;
  }

  if (!res.ok) {
    // 401 means the key is wrong or revoked — worth naming, because the
    // symptom otherwise is "no builder ever has launches", which reads as
    // nobody using Bags rather than as a broken credential.
    if (res.status === 401 || res.status === 403) {
      console.error(
        `Bags API rejected the key (HTTP ${res.status}) on ${path}`,
      );
    }
    return null;
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return null;
  }

  if (!isRecord(body) || body.success !== true) return null;
  return body.response ?? null;
}

/**
 * Token mints where `wallet` holds fee-share admin authority — in practice, the
 * launches that wallet is behind.
 *
 * Returns null when Bags is unreachable or unconfigured, and an empty array
 * when the wallet simply has no launches. Callers must distinguish the two:
 * null means "unknown, try later", [] means "asked, genuinely none".
 */
export async function fetchLaunchesForWallet(
  wallet: string,
): Promise<string[] | null> {
  if (!SOLANA_ADDRESS_RE.test(wallet)) return null;

  const response = await bagsGet("/fee-share/admin/list", { wallet });
  if (!isRecord(response)) return null;

  const mints = response.tokenMints;
  if (!Array.isArray(mints)) return null;

  // Drop anything that isn't a plausible mint rather than trusting the payload.
  return mints.filter(
    (m): m is string => typeof m === "string" && SOLANA_ADDRESS_RE.test(m),
  );
}

/** A launch this wallet genuinely created, as confirmed by the creator record. */
export type BagsLaunch = {
  tokenMint: string;
  /** Verified X handle Bags holds for the creator, when it has one. */
  twitterUsername: string | null;
  /** Creator's share of fees, in basis points. */
  royaltyBps: number;
};

type CreatorEntry = {
  wallet?: unknown;
  isCreator?: unknown;
  twitterUsername?: unknown;
  royaltyBps?: unknown;
  /** The creator's handle on Bags itself, distinct from their X handle. */
  bagsUsername?: unknown;
  /** Avatar Bags holds for the creator, sourced from their linked social. */
  pfp?: unknown;
};

/**
 * Creator records for one token, or null when Bags could not answer.
 *
 * An empty array is a real answer: Bags knows the mint but holds no creator
 * record for it.
 */
export async function fetchTokenCreators(
  tokenMint: string,
): Promise<CreatorEntry[] | null> {
  if (!SOLANA_ADDRESS_RE.test(tokenMint)) return null;
  const response = await bagsGet("/token-launch/creator/v3", { tokenMint });
  return Array.isArray(response) ? (response as CreatorEntry[]) : null;
}

/**
 * The launches a wallet actually created.
 *
 * Two steps, deliberately. `fee-share/admin/list` answers "which mints does
 * this wallet hold fee-share authority over", which is NOT the same question as
 * "what did this wallet launch" — it also returns tokens carrying no creator
 * record at all. Reporting those as launches would credit a builder with work
 * they did not do, which is the one failure this product cannot afford.
 *
 * So each candidate is confirmed against its creator record, and only mints
 * listing this wallet with `isCreator: true` survive.
 *
 * Verified against production data: wallet 4Evn…WwX9 has three fee-share mints
 * and exactly one real launch ($VIBE); the other two return no creators.
 */
export async function fetchCreatedLaunches(
  wallet: string,
): Promise<BagsLaunch[] | null> {
  const candidates = await fetchLaunchesForWallet(wallet);
  if (candidates === null) return null;
  if (candidates.length === 0) return [];

  const launches: BagsLaunch[] = [];
  for (const tokenMint of candidates) {
    const creators = await fetchTokenCreators(tokenMint);
    if (!creators) continue; // couldn't confirm — omit rather than guess

    const mine = creators.find(
      (c) =>
        typeof c.wallet === "string" &&
        c.wallet === wallet &&
        c.isCreator === true,
    );
    if (!mine) continue;

    launches.push({
      tokenMint,
      twitterUsername:
        typeof mine.twitterUsername === "string" && mine.twitterUsername.trim()
          ? mine.twitterUsername.trim()
          : null,
      royaltyBps: typeof mine.royaltyBps === "number" ? mine.royaltyBps : 0,
    });
  }
  return launches;
}

/** Who Bags says a wallet is, for one launch it created. */
export type BagsCreatorProfile = {
  /** Handle on Bags itself. Null when the creator never claimed one. */
  bagsUsername: string | null;
  /** X handle Bags holds for them, verified on their side. */
  twitterUsername: string | null;
  pfpUrl: string | null;
  royaltyBps: number;
};

/** Trim a string field off an untrusted payload, treating blank as absent. */
function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * The Bags-side identity behind a launch: their Bags handle, X handle and
 * avatar.
 *
 * This is the answer to "can we link a Bags account": we never have to ask the
 * builder to connect one. Because the wallet was already bound to their profile
 * by signature, whatever Bags reports for that wallet's creator record is
 * transitively theirs — a stronger link than an OAuth connect, which would only
 * prove they can log into an account.
 *
 * Null when Bags cannot confirm this wallet as the creator of this mint, which
 * is also the guard against showing one person's identity on another's launch.
 */
export async function fetchCreatorProfile(
  tokenMint: string,
  wallet: string,
): Promise<BagsCreatorProfile | null> {
  const creators = await fetchTokenCreators(tokenMint);
  if (!creators) return null;

  const mine = creators.find(
    (c) =>
      typeof c.wallet === "string" &&
      c.wallet === wallet &&
      c.isCreator === true,
  );
  if (!mine) return null;

  return {
    bagsUsername: str(mine.bagsUsername),
    twitterUsername: str(mine.twitterUsername),
    pfpUrl: str(mine.pfp),
    royaltyBps: typeof mine.royaltyBps === "number" ? mine.royaltyBps : 0,
  };
}
