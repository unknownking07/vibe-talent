// Every tunable constant for $VIBE utility. Calibration values are expected to
// change once there's real usage; nothing here should require touching burn,
// verification or scoring logic to adjust.
//
// Design: docs/superpowers/specs/2026-08-11-vibe-utility-design.md

import { CHAIN_CONFIGS, isSolanaChain } from "@/lib/chains-config";

const solana = CHAIN_CONFIGS.solana;

/** $VIBE mint. Re-exported so consumers don't repeat the isSolanaChain narrow. */
export const VIBE_MINT = isSolanaChain(solana) ? solana.vibeMint : "";
export const VIBE_DECIMALS = isSolanaChain(solana) ? solana.vibeDecimals : 9;

// $VIBE sits on a Meteora DBC bonding curve, which is why Jupiter can't route
// it (`TOKEN_NOT_TRADABLE`). Buying is an outbound link, not an embedded swap.
export const VIBE_BUY_URL = `https://bags.fm/${VIBE_MINT}`;
export const VIBE_CHART_URL = `https://dexscreener.com/solana/${VIBE_MINT}`;
export const VIBE_EXPLORER_URL = `https://solscan.io/token/${VIBE_MINT}`;

export const VOUCH = {
  /** Minimum burn to vouch, USD. */
  minUsd: 2,
  /** Amounts offered in the UI, USD. */
  presetsUsd: [2, 5, 10, 25],
  /** Max vibe_score points a single voucher can contribute. */
  perVoucherCapPoints: 5,
  /** Max vibe_score points all vouches combined can add to one profile. */
  perProfileCapPoints: 25,
  /**
   * Below this vibe_score a voucher's burn is display-only, worth 0 points.
   * This is the Sybil defence: without it ~25 throwaway accounts burning $4
   * each could max a profile for around $100.
   */
  voucherMinVibeScore: 20,
} as const;

export const STREAK_PROTECT = {
  /** Price of one restore, USD. */
  usdPrice: 1,
  /** Hours after the break during which a restore may be bought. */
  graceHours: 48,
  /** Refuse to restore a larger gap — no buying back a lost week. */
  maxGapDays: 2,
  /** Paid restores allowed per calendar month. */
  maxPaidPerMonth: 2,
  /** Don't offer a restore for a streak shorter than this. */
  minStreakToOffer: 3,
} as const;

/**
 * Free monthly streak freezes by $VIBE held, richest tier first.
 *
 * Evaluated once on the 1st when the allowance is granted, and held for the
 * whole month. At this market cap a single trade can move the price ~30%, so
 * re-evaluating mid-month would flicker users in and out of their tier.
 */
export const HOLDER_TIERS = [
  { key: "patron", label: "Patron", minUsd: 40, freezes: 4 },
  { key: "backer", label: "Backer", minUsd: 10, freezes: 3 },
] as const;

/** Allowance for a user holding nothing. Matches today's behaviour. */
export const BASE_FREEZES = 2;

export type HolderTier = (typeof HOLDER_TIERS)[number];

/** Richest tier whose threshold `usdHeld` meets, or null. */
export function holderTierFor(usdHeld: number): HolderTier | null {
  return HOLDER_TIERS.find((t) => usdHeld >= t.minUsd) ?? null;
}

/** Free monthly freezes for a given USD holding. */
export function freezeAllowanceFor(usdHeld: number): number {
  return holderTierFor(usdHeld)?.freezes ?? BASE_FREEZES;
}
