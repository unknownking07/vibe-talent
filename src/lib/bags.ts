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
async function bagsGet(path: string, params: Record<string, string>): Promise<unknown | null> {
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
      console.error(`Bags API rejected the key (HTTP ${res.status}) on ${path}`);
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
export async function fetchLaunchesForWallet(wallet: string): Promise<string[] | null> {
  if (!SOLANA_ADDRESS_RE.test(wallet)) return null;

  const response = await bagsGet("/fee-share/admin/list", { wallet });
  if (!isRecord(response)) return null;

  const mints = response.tokenMints;
  if (!Array.isArray(mints)) return null;

  // Drop anything that isn't a plausible mint rather than trusting the payload.
  return mints.filter((m): m is string => typeof m === "string" && SOLANA_ADDRESS_RE.test(m));
}
