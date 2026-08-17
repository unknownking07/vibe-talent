// Vouch point maths.
//
// IMPORTANT: vibe_score is computed in SQL by update_user_streak(), which is
// the source of truth. This module is a MIRROR, used only to preview "you'll
// give +N" in the UI before someone burns. The two must agree — the table in
// __tests__/vouch.test.ts is the same one verified against live Postgres when
// the migration was written. Change one, change both.
//
// Design: docs/superpowers/specs/2026-08-11-vibe-utility-design.md

import { VOUCH } from "@/lib/vibe-config";

/**
 * How much a voucher's money counts, from 0 to 1.
 *
 * Below `voucherMinVibeScore` this is 0: the burn still shows publicly on the
 * profile (it genuinely happened) but contributes nothing to the score. That
 * floor is the Sybil defence — without it roughly 25 throwaway accounts burning
 * $4 each could max out a profile for about $100. With it, buying rank requires
 * accounts that already earned a score through real work, which is the
 * expensive part.
 */
export function voucherCredibility(voucherVibeScore: number): number {
  if (voucherVibeScore < VOUCH.voucherMinVibeScore) return 0;
  return 0.5 + 0.5 * Math.min(voucherVibeScore / 200, 1);
}

/**
 * Points a single voucher contributes, given their TOTAL burned USD for one
 * builder. Callers must aggregate a voucher's burns before calling: re-vouching
 * adds to their total *before* the per-voucher cap applies.
 */
export function vouchPoints(totalUsd: number, voucherVibeScore: number): number {
  const credibility = voucherCredibility(voucherVibeScore);
  if (credibility === 0) return 0;
  if (!(totalUsd > 0)) return 0;
  return Math.min(
    Math.floor(Math.sqrt(totalUsd) * credibility),
    VOUCH.perVoucherCapPoints,
  );
}

/**
 * Total points across all vouchers for one builder, profile-capped.
 * Each entry is one voucher's aggregated burn.
 */
export function totalVouchPoints(
  vouchers: Array<{ usd: number; voucherVibeScore: number }>,
): number {
  const sum = vouchers.reduce(
    (acc, v) => acc + vouchPoints(v.usd, v.voucherVibeScore),
    0,
  );
  return Math.min(sum, VOUCH.perProfileCapPoints);
}
