// Server-only. Proving wallet ownership WITHOUT connecting the wallet to the site.
//
// WHY THIS EXISTS: some builders will not connect a deployer wallet to a
// website, and that instinct is reasonable. This gives them a second route:
// broadcast one transaction from the wallet carrying a memo we issued, then
// paste the signature here.
//
// AMOUNT FIRST, MEMO IF THE WALLET CAN. The first cut of this was memo-only,
// because a memo is a sentence the signer reads and an amount is not. It was
// the safer design and it was unusable: Phantom does not expose a memo field,
// nor do most Solana wallets, so a builder who tried it simply could not
// complete the flow. An unusable proof is not a safe proof — it pushes people
// back to connecting their wallet, which is the thing this route exists to
// avoid. So the challenge is now a random lamport amount that any wallet can
// send, and a memo is accepted as well when the sender can attach one.
//
// WHAT THE AMOUNT DOES AND DOES NOT DO. Unpredictable per challenge, it stops
// one open challenge being satisfied by another's transaction, and it cannot be
// guessed by someone who was not issued it. It does NOT carry intent: a payer
// sees a number and an address, so a phisher can still forward "send exactly
// this to that" and be credited with the victim's wallet. A memo mitigates
// that where it is available, and nothing here removes it. Short expiry keeps
// the window narrow. Never describe this route as phishing-proof.
//
// The residual risk is bounded by key control: whoever holds the key can always
// prove the wallet again, so a stolen attribution is recoverable rather than
// permanent.
//
// This route is deliberately NOT the default. Signing a message cannot move
// funds; broadcasting a transaction can. The message signature stays the
// recommended path and this is the fallback for people who will not use it.

import { CHAIN_CONFIGS, isSolanaChain } from "@/lib/chains-config";
import { solanaRpcUrl } from "@/lib/solana-rpc";
import { extractMemos } from "@/lib/promotion-pricing";
import { WALLET_LINK_DOMAIN, SOLANA_ADDRESS_RE } from "@/lib/wallet-link";

/** Narrow an unknown value to a plain object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

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
 * Smallest and largest challenge amounts, in lamports.
 *
 * Both ends sit under a cent at any plausible SOL price, so the proof costs the
 * builder effectively nothing beyond the network fee. The range is wide enough
 * that two open challenges colliding is not a practical concern, and the value
 * is drawn from a CSPRNG so nobody can guess a challenge they were not issued.
 */
export const MIN_CHALLENGE_LAMPORTS = 1_000;
export const MAX_CHALLENGE_LAMPORTS = 40_000;

/** A fresh, unguessable challenge amount. */
export function randomChallengeLamports(): number {
  const span = MAX_CHALLENGE_LAMPORTS - MIN_CHALLENGE_LAMPORTS;
  const [n] = crypto.getRandomValues(new Uint32Array(1));
  return MIN_CHALLENGE_LAMPORTS + (n! % span);
}

/**
 * The optional memo, for wallets that can attach one.
 *
 * Names the account on purpose: without it the text reads "link a wallet to
 * vibetalent.work", which is exactly what a victim would expect while being
 * phished into proving their wallet for someone else. Most wallets cannot
 * attach this, which is why it can never be the only binding.
 */
export function transferMemo(nonce: string, username: string): string {
  return `Link wallet to ${WALLET_LINK_DOMAIN} for @${username} | ${nonce}`;
}

/** A base58 Solana transaction signature. */
export const SIGNATURE_RE = /^[1-9A-HJ-NP-Za-km-z]{86,90}$/;

export type TransferProofResult =
  { ok: true; wallet: string } | { ok: false; status: number; error: string };

/**
 * What a builder has to produce. Either half proves it: the amount is what
 * every wallet can send, the memo is the stronger binding for the few that can
 * attach one.
 */
export type TransferChallenge = {
  lamports: number;
  memo: string;
  /**
   * Unix seconds when this challenge was issued.
   *
   * Load-bearing. Without it a transaction that predates the challenge
   * satisfies it, so anyone could read our receiving wallet's history, find a
   * past transfer, draw challenges until the amount matched, and be credited
   * with a stranger's wallet without that stranger doing anything at all.
   */
  issuedAt: number;
};

type ParsedAccountKey = { pubkey?: unknown; signer?: unknown };

type ParsedTx = {
  blockTime?: unknown;
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
  challenge: TransferChallenge,
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

  // Must postdate the challenge. An amount alone does not tie a transfer to a
  // particular challenge, so without this boundary an old transaction — the
  // sender's own earlier verification, say — could be replayed to claim their
  // wallet for somebody else. A missing blockTime is treated as unusable
  // rather than assumed recent.
  const blockTime = typeof tx.blockTime === "number" ? tx.blockTime : null;
  if (blockTime === null || blockTime < challenge.issuedAt) {
    return {
      ok: false,
      status: 400,
      error: "That transaction predates this verification. Send a new one.",
    };
  }

  // The memo must match in full. A partial match would let one challenge's
  // transaction satisfy another's.
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
  const wallet = feePayer.pubkey;

  const instructions = tx.transaction?.message?.instructions ?? [];

  // The memo path, for wallets that can attach one. Matched in full: a partial
  // match would let one challenge's transaction satisfy another's.
  const memoMatched = extractMemos(instructions).some(
    (m) => m.trim() === challenge.memo,
  );

  // The amount path, which every wallet can do. The transfer has to come FROM
  // the wallet being proved and land on our receiving address for exactly the
  // challenge amount, so an unrelated payment of a round number cannot pass.
  const amountMatched = instructions.some((ix) => {
    const parsed = (ix as { parsed?: unknown })?.parsed;
    if (!isRecord(parsed) || parsed.type !== "transfer") return false;
    const info = parsed.info;
    if (!isRecord(info)) return false;
    return (
      info.source === wallet &&
      info.destination === solana.receivingWallet &&
      Number(info.lamports) === challenge.lamports
    );
  });

  if (!memoMatched && !amountMatched) {
    return {
      ok: false,
      status: 400,
      error: "That transaction doesn't match this verification.",
    };
  }

  return { ok: true, wallet };
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
  challenge: TransferChallenge,
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
    const result = await verifyTransferProof(signature, challenge);
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
