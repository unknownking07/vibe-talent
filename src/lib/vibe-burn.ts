// Pure burn logic for $VIBE: action-memo binding and burn detection.
//
// Deliberately free of @solana/web3.js so the server-side verifier and the API
// routes don't drag the web3 bundle into the Worker. Transaction CONSTRUCTION
// lives in solana-payment.ts next to its transfer sibling, which already
// carries those imports and only ever loads on the client.
//
// Design: docs/superpowers/specs/2026-08-11-vibe-utility-design.md

import { passesSlippage } from "@/lib/promotion-pricing";

// ── Action binding ──

export type BurnAction =
  | { kind: "vouch"; actorId: string; targetId: string }
  | { kind: "protect"; actorId: string; breakDate: string };

/**
 * The memo stamped into the signed transaction.
 *
 * It must name the ACTOR as well as the target. The featuring flow gets away
 * with a target-only memo because that endpoint separately gates on "you own
 * this project"; burns have no equivalent owner gate, so without the actor a
 * user could submit someone else's already-broadcast burn and be credited for
 * it. The memo is inside the signed payload, so it can't be forged after the
 * fact.
 */
export function buildBurnMemo(action: BurnAction): string {
  return action.kind === "vouch"
    ? `vouch:${action.actorId}:${action.targetId}`
    : `protect:${action.actorId}:${action.breakDate}`;
}

/** Parse a memo back into an action. Returns null for anything unrecognised. */
export function parseBurnMemo(memo: string): BurnAction | null {
  const parts = (memo || "").split(":");
  if (parts.length !== 3) return null;
  const [kind, actorId, third] = parts;
  if (!actorId || !third) return null;
  if (kind === "vouch") return { kind: "vouch", actorId, targetId: third };
  if (kind === "protect") return { kind: "protect", actorId, breakDate: third };
  return null;
}

/** Do two actions refer to exactly the same thing? Every field must match. */
export function sameBurnAction(a: BurnAction, b: BurnAction): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "vouch" && b.kind === "vouch") {
    return a.actorId === b.actorId && a.targetId === b.targetId;
  }
  if (a.kind === "protect" && b.kind === "protect") {
    return a.actorId === b.actorId && a.breakDate === b.breakDate;
  }
  return false;
}

// ── Burn detection ──

type TokenBalance = {
  owner?: string | null;
  mint: string;
  uiTokenAmount?: { amount?: string | null } | null;
};

/**
 * Net change in how many base units of `mint` EXIST, across every account the
 * transaction touched.
 *
 * A transfer moves tokens between two touched accounts, so the sum is zero. A
 * burn destroys them, so the sum goes negative. That invariant is why this is
 * used instead of parsing `burn` / `burnChecked` instructions: their jsonParsed
 * shape could not be confirmed against a live transaction (a 120-transaction
 * sample across USDC and BONK surfaced only transfer / transferChecked), and
 * guessing field names risks a silent failure on a path that grants value.
 */
export function netTokenDelta(
  pre: TokenBalance[],
  post: TokenBalance[],
  mint: string,
): bigint {
  const sum = (arr: TokenBalance[]) =>
    (arr || [])
      .filter((b) => b.mint === mint)
      .reduce((acc, b) => acc + BigInt(b.uiTokenAmount?.amount || "0"), BigInt(0));
  return sum(post) - sum(pre);
}

/**
 * Did this transaction destroy at least `expected` base units of `mint`?
 *
 * Allows the same 10% slippage floor the transfer path uses, since the $VIBE
 * price moves between quoting an amount and the wallet signing it.
 */
export function burnedAtLeast(
  pre: TokenBalance[],
  post: TokenBalance[],
  mint: string,
  expected: bigint,
  floorBps = 9000,
): boolean {
  const destroyed = -netTokenDelta(pre, post, mint);
  if (destroyed <= BigInt(0)) return false;
  return passesSlippage(destroyed, expected, floorBps);
}
