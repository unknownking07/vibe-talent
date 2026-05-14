export const MIN_REVIEWS_FOR_CALIBRATION = 5;

export interface ReviewForCalibration {
  rating: number;          // 1-5
  builderPercentile: number; // 0.0-1.0
}

/**
 * Calibration score = 100 - (mean absolute error between normalized rating and builder percentile) * 100.
 * Returns null when reviewer has fewer than MIN_REVIEWS_FOR_CALIBRATION reviews.
 *
 * Normalized rating: rating / 5 (so 5★ = 1.0, 1★ = 0.2).
 * builderPercentile: the reviewed builder's rank percentile across all users (0.0 worst, 1.0 best).
 */
export function computeCalibration(reviews: ReviewForCalibration[]): number | null {
  if (reviews.length < MIN_REVIEWS_FOR_CALIBRATION) return null;

  const errors = reviews.map((r) => Math.abs(r.rating / 5 - r.builderPercentile));
  const meanError = errors.reduce((s, e) => s + e, 0) / errors.length;
  const calibration = 100 - meanError * 100;

  return Math.round(calibration * 100) / 100;
}
