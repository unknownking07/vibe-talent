export type ReviewerTier = "bronze" | "silver" | "gold";

export const TIER_THRESHOLDS = {
  bronze: { minReviews: 10, minCalibration: 70 },
  silver: { minReviews: 30, minCalibration: 80 },
  gold:   { minReviews: 75, minCalibration: 85 },
} as const;

/**
 * Returns the highest tier whose BOTH thresholds (minReviews and minCalibration)
 * are met by the reviewer. Returns null below bronze.
 */
export function classifyTier(
  calibration: number | null,
  reviewCount: number,
): ReviewerTier | null {
  if (calibration == null) return null;

  if (
    reviewCount >= TIER_THRESHOLDS.gold.minReviews &&
    calibration >= TIER_THRESHOLDS.gold.minCalibration
  ) return "gold";

  if (
    reviewCount >= TIER_THRESHOLDS.silver.minReviews &&
    calibration >= TIER_THRESHOLDS.silver.minCalibration
  ) return "silver";

  if (
    reviewCount >= TIER_THRESHOLDS.bronze.minReviews &&
    calibration >= TIER_THRESHOLDS.bronze.minCalibration
  ) return "bronze";

  return null;
}
