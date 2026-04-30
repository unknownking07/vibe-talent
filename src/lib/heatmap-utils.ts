/**
 * Shared utilities for the contribution heatmap components.
 *
 * Used by ProfileHeatmap and ActivityHeatmap so both views agree on how
 * a raw per-day commit count maps to a color intensity bucket.
 */

/**
 * Bucket a real per-day commit count into a 0-4 color intensity.
 * Mirrors GitHub's own contribution calendar feel (low/mid/high days
 * look low/mid/high).
 */
export function countToLevel(count: number): number {
  if (count <= 0) return 0;
  if (count < 3) return 1;
  if (count < 8) return 2;
  if (count < 20) return 3;
  return 4;
}
