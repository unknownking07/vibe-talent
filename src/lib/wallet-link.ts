// Shared between the wallet nonce and link routes.
//
// The signed message must be byte-identical on both sides or ed25519
// verification fails, so it is built in exactly one place. These live in lib
// rather than in the route file because App Router restricts what a route.ts
// may export alongside its HTTP handlers.

export const NONCE_TTL_SECONDS = 300;

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
    `Nonce: ${nonce}`,
    "",
    "This proves you own the wallet. It does not approve any transaction, spend, or token transfer.",
  ].join("\n");
}

/** Solana base58 pubkey. */
export const SOLANA_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
