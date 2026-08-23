// Server-only. Proving wallet ownership WITHOUT connecting the wallet to the site.
//
// WHY THIS EXISTS: some builders will not connect a deployer wallet to a
// website, and that instinct is reasonable. This gives them a second route:
// broadcast one transaction from the wallet carrying a memo we issued, then
// paste the signature here.
//
// WHY IT IS MEMO-BOUND, AND WHY THAT IS THE WHOLE DESIGN: a bare transfer
// carries no statement of intent that the payer can read, which makes the
// scheme relayable. An attacker starts a challenge on their own account, gets
// "send this amount to this address", talks the real deployer into sending it
// ("pay 0.0001 SOL to claim your fees"), and the system verifies the ATTACKER
// as the owner. Unique amounts and short expiry narrow that window; they do not
// close it, because a live phishing page works in real time.
//
// A memo closes it, because the memo is a sentence the signer sees: an attacker
// now has to talk their victim into attaching text that says, in plain words,
// that they are linking a wallet to vibetalent.work. This codebase already
// learned the same lesson for $VIBE burns, where matching the full memo is what
// stops one user claiming another's broadcast transaction.
//
// WHY IT IS A SELF-PAYMENT, NOT A PAYMENT TO US: the proof is the SIGNATURE on
// the transaction, not the movement of funds. Nobody can produce a signed
// transaction without the key, so the destination is irrelevant. Sending to
// their own wallet costs the builder nothing beyond the network fee, leaves us
// with no dust to custody, and removes the "send X to this address" instruction
// that a phishing page would otherwise be imitating.
//
// This route is deliberately NOT the default. Signing a message cannot move
// funds; broadcasting a transaction can. The message signature stays the
// recommended path and this is the fallback for people who will not use it.

import { CHAIN_CONFIGS, isSolanaChain } from "@/lib/chains-config";
import { solanaRpcUrl } from "@/lib/solana-rpc";
import { extractMemos } from "@/lib/promotion-pricing";
import { WALLET_LINK_DOMAIN, SOLANA_ADDRESS_RE } from "@/lib/wallet-link";

/** Every RPC call in this module is bounded by this. */
const REQUEST_TIMEOUT_MS = 8_000;

/**
 * Longer than the signing nonce: this flow asks someone to construct and
 * broadcast a transaction, possibly in a different wallet app, rather than
 * approve a prompt that is already on screen.
 */
export const TRANSFER_NONCE_TTL_SECONDS = 900;

export function transferNonceKey(userId: string): string {
  return `wallet-transfer-nonce:${userId}`;
}

/**
 * The memo the transaction must carry, verbatim.
 *
 * NAMES THE ACCOUNT ON PURPOSE. Without it the memo says only "link a wallet to
 * vibetalent.work", which is exactly what a victim would expect to see while
 * being phished into proving their wallet for someone else's account. With the
 * username in it, the sentence a phisher has to talk them past reads "for
 * @somebody-who-is-not-you", which they can check against their own profile.
 *
 * This raises the bar; it does not remove it. A challenge-response scheme with
 * no second channel cannot stop someone who signs anyway, and the same is true
 * of the message-signature route. Never describe either as phishing-proof.
 */
export function transferMemo(nonce: string, username: string): string {
  return `Link wallet to ${WALLET_LINK_DOMAIN} for @${username} | ${nonce}`;
}

/** A base58 Solana transaction signature. */
export const SIGNATURE_RE = /^[1-9A-HJ-NP-Za-km-z]{86,90}$/;

export type TransferProofResult =
  { ok: true; wallet: string } | { ok: false; status: number; error: string };

type ParsedAccountKey = { pubkey?: unknown; signer?: unknown };

type ParsedTx = {
  meta?: { err?: unknown } | null;
  transaction?: {
    message?: {
      accountKeys?: ParsedAccountKey[];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      instructions?: any[];
    };
  };
};

/**
 * Confirm that `signature` is a settled Solana transaction carrying
 * `expectedMemo`, and return the wallet that signed it.
 *
 * The proving wallet is READ OFF the transaction rather than supplied by the
 * caller. A caller who could name the wallet could name someone else's; the fee
 * payer is by definition a signer, so taking it from the transaction means the
 * only wallet anyone can prove is one they hold the key to.
 *
 * 404 and 503 are distinguished from 400 so the client can retry a transaction
 * that has not propagated yet without hiding a genuine mismatch.
 */
export async function verifyTransferProof(
  signature: string,
  expectedMemo: string,
): Promise<TransferProofResult> {
  if (!SIGNATURE_RE.test(signature)) {
    return {
      ok: false,
      status: 400,
      error: "That doesn't look like a transaction signature.",
    };
  }

  const solana = CHAIN_CONFIGS.solana;
  if (!isSolanaChain(solana)) {
    return { ok: false, status: 500, error: "Solana is not configured." };
  }

  let txJson: { error?: unknown; result?: ParsedTx };
  try {
    const res = await fetch(solanaRpcUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Bounded like every other call here: findTransferProof issues this in a
      // loop, so an untimed request lets one slow provider hold the route open
      // while the client keeps polling every five seconds.
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTransaction",
        params: [
          signature,
          {
            // 'confirmed' rather than 'finalized' so this works seconds after
            // the wallet returns, matching the burn path.
            commitment: "confirmed",
            maxSupportedTransactionVersion: 0,
            encoding: "jsonParsed",
          },
        ],
      }),
    });
    if (!res.ok) {
      return {
        ok: false,
        status: 503,
        error: "Couldn't reach the Solana network. Please retry.",
      };
    }
    txJson = await res.json();
  } catch {
    return {
      ok: false,
      status: 503,
      error: "Couldn't reach the Solana network. Please retry.",
    };
  }

  if (txJson?.error) {
    return { ok: false, status: 503, error: "Solana RPC error. Please retry." };
  }

  const tx = txJson?.result;
  if (!tx) {
    return {
      ok: false,
      status: 404,
      error: "Transaction not found or not confirmed yet.",
    };
  }
  if (tx.meta?.err) {
    return {
      ok: false,
      status: 400,
      error: "That transaction failed on-chain.",
    };
  }

  // The memo must match in full. A partial match would let one challenge's
  // transaction satisfy another's.
  const memos = extractMemos(tx.transaction?.message?.instructions ?? []);
  if (!memos.some((m) => m.trim() === expectedMemo)) {
    return {
      ok: false,
      status: 400,
      error: "That transaction doesn't carry this verification's memo.",
    };
  }

  const keys = tx.transaction?.message?.accountKeys;
  const feePayer = Array.isArray(keys) ? keys[0] : undefined;
  if (
    !feePayer ||
    feePayer.signer !== true ||
    typeof feePayer.pubkey !== "string" ||
    !SOLANA_ADDRESS_RE.test(feePayer.pubkey)
  ) {
    return {
      ok: false,
      status: 400,
      error: "Couldn't read a signer from that transaction.",
    };
  }

  return { ok: true, wallet: feePayer.pubkey };
}

/**
 * How many recent transactions to scan when watching a wallet.
 *
 * The builder has just been told to send one, so the proof is near the top of
 * their history. Scanning deeper costs an RPC round trip per signature for a
 * transaction that is not there.
 */
const WATCH_DEPTH = 12;

/**
 * Total time one scan may spend. The client polls every five seconds, so a
 * scan that outlives its own poll interval only stacks up work.
 */
const SCAN_BUDGET_MS = 12_000;

/**
 * Watch `address` for a transaction carrying `expectedMemo`, without the
 * builder having to copy a signature back.
 *
 * The address is supplied by the caller here, which is safe for one reason
 * only: naming a wallet proves nothing. The proof is still a signed
 * transaction carrying a challenge nobody else was issued, so pointing us at
 * someone else's wallet finds nothing unless they were handed this exact memo.
 *
 * 404 means "not seen yet" rather than "wrong": the client polls, and a
 * transaction can take a few seconds to reach the RPC after the wallet returns.
 */
export async function findTransferProof(
  address: string,
  expectedMemo: string,
): Promise<TransferProofResult> {
  if (!SOLANA_ADDRESS_RE.test(address)) {
    return {
      ok: false,
      status: 400,
      error: "That doesn't look like a Solana address.",
    };
  }

  const solana = CHAIN_CONFIGS.solana;
  if (!isSolanaChain(solana)) {
    return { ok: false, status: 500, error: "Solana is not configured." };
  }

  let signatures: string[];
  try {
    const res = await fetch(solanaRpcUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getSignaturesForAddress",
        params: [address, { limit: WATCH_DEPTH, commitment: "confirmed" }],
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      return {
        ok: false,
        status: 503,
        error: "Couldn't reach the Solana network. Please retry.",
      };
    }
    const body = await res.json();
    const result = body?.result;
    if (!Array.isArray(result)) {
      return {
        ok: false,
        status: 503,
        error: "Solana RPC error. Please retry.",
      };
    }
    signatures = result
      .map((entry: { signature?: unknown; err?: unknown }) =>
        // Skip failed transactions here rather than fetching them in full.
        !entry?.err && typeof entry?.signature === "string"
          ? entry.signature
          : null,
      )
      .filter((sig): sig is string => sig !== null);
  } catch {
    return {
      ok: false,
      status: 503,
      error: "Couldn't reach the Solana network. Please retry.",
    };
  }

  // Wall-clock budget for the whole scan. Twelve sequential lookups at the
  // per-call timeout would otherwise be a minute and a half.
  const deadline = Date.now() + SCAN_BUDGET_MS;

  for (const signature of signatures) {
    if (Date.now() > deadline) break;
    const result = await verifyTransferProof(signature, expectedMemo);
    // Only a match ends the search. Every other outcome means this particular
    // transaction was something else the builder happened to do.
    if (result.ok && result.wallet === address) return result;
  }

  return {
    ok: false,
    status: 404,
    error: "No matching transaction yet. Send it, then this will pick it up.",
  };
}
