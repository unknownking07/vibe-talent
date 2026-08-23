// Shared between the wallet nonce and link routes.
//
// The signed message must be byte-identical on both sides or ed25519
// verification fails, so it is built in exactly one place. These live in lib
// rather than in the route file because App Router restricts what a route.ts
// may export alongside its HTTP handlers.

export const NONCE_TTL_SECONDS = 300;

/**
 * The site named inside the signed message.
 *
 * Hardcoded rather than read from the request: a header-derived host is
 * attacker-controllable, and the whole point of the line is to tell the signer
 * which site they are approving. Someone reading a wallet prompt should be able
 * to compare this against their address bar.
 */
export const WALLET_LINK_DOMAIN = "vibetalent.work";

export function nonceKey(userId: string): string {
  return `wallet-nonce:${userId}`;
}

/**
 * The message the user signs to prove wallet ownership.
 *
 * Deliberately states that it authorizes nothing: a wallet prompt asking for a
 * signature is exactly what a drainer looks like, so the text has to make the
 * scope obvious before someone approves it.
 */
export function nonceMessage(nonce: string): string {
  return [
    "Link this wallet to your VibeTalent account.",
    "",
    `Site: ${WALLET_LINK_DOMAIN}`,
    `Nonce: ${nonce}`,
    `Valid for: ${NONCE_TTL_SECONDS / 60} minutes`,
    "",
    "This proves you own the wallet. It does not approve any transaction, spend, or token transfer.",
  ].join("\n");
}

/** Solana base58 pubkey. */
export const SOLANA_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/** A 64-byte ed25519 signature, base58 encoded. */
export const BASE58_SIGNATURE_RE = /^[1-9A-HJ-NP-Za-km-z]{86,90}$/;

// ---------------------------------------------------------------------------
// Local staging development nonce store
// ---------------------------------------------------------------------------
//
// In local development there is no Upstash Redis, so wallet-ownership
// verification would be completely unavailable. This in-memory store lets
// developers exercise the full link flow without external services.
//
// It is gated behind BOTH of these conditions so it can NEVER shadow the
// real Redis-backed store in staging or production:
//   NODE_ENV === 'development'  AND  VIBE_STAGING === '1'
//
// Entries are single-use: consume() deletes them before returning, mirroring
// the atomic GETDEL operation used with Redis.

type LocalNonceEntry = {
  nonce: string;
  expiresAt: number; // Date.now() milliseconds
};

// Typed extension of globalThis so we avoid `any` casts throughout.
type LocalNonceGlobalThis = typeof globalThis & {
  __vibe_wallet_nonce_store?: Map<string, LocalNonceEntry>;
};

/** True only in local staging development, where the in-memory store is used. */
export function isLocalWalletNonceStoreEnabled(): boolean {
  return (
    process.env.NODE_ENV === "development" && process.env.VIBE_STAGING === "1"
  );
}

function getLocalStore(): Map<string, LocalNonceEntry> | null {
  if (!isLocalWalletNonceStoreEnabled()) return null;
  // globalThis survives across Hot Module Replacement reloads so a developer
  // mid-flow does not lose their nonce when the dev server recompiles.
  const global = globalThis as LocalNonceGlobalThis;
  if (!global.__vibe_wallet_nonce_store) {
    global.__vibe_wallet_nonce_store = new Map<string, LocalNonceEntry>();
  }
  return global.__vibe_wallet_nonce_store;
}

/**
 * Store a nonce locally. Returns false when not in local mode (caller must
 * fall back to Redis).
 */
export function localStoreNonce(key: string, nonce: string): boolean {
  const store = getLocalStore();
  if (!store) return false;
  store.set(key, {
    nonce,
    expiresAt: Date.now() + NONCE_TTL_SECONDS * 1000,
  });
  return true;
}

/**
 * Look at a nonce without spending it.
 *
 * The watched transfer flow polls, so it has to be able to ask "is my challenge
 * still open" without consuming it on every failed look.
 */
export function localPeekNonce(key: string): string | null {
  const store = getLocalStore();
  if (!store) return null;
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.nonce;
}

/**
 * Consume a nonce from the local store. Deletes the entry before returning so
 * it cannot be replayed. Returns null when the entry is missing, expired, or
 * when not in local mode.
 */
export function localConsumeNonce(key: string): string | null {
  const store = getLocalStore();
  if (!store) return null;
  const entry = store.get(key);
  if (!entry) return null;
  store.delete(key);
  if (Date.now() >= entry.expiresAt) return null;
  return entry.nonce;
}
