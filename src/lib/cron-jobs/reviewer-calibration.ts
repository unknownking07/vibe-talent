import { createAdminClient } from "@/lib/supabase/admin";
import { computeCalibration, MIN_REVIEWS_FOR_CALIBRATION } from "@/lib/reviewer/calibration";
import { classifyTier } from "@/lib/reviewer/tier";

/**
 * Nightly: recompute reviewer_calibration + reviewer_tier for every user
 * who has authored >= MIN_REVIEWS_FOR_CALIBRATION reviews with reviewer_user_id set.
 *
 * Anonymous reviews (reviewer_user_id IS NULL) are skipped.
 */
export async function runReviewerCalibration(): Promise<{ updated: number; skipped: number }> {
  const sb = createAdminClient();

  // 1. Pull all reviews with a logged-in reviewer + the builder's vibe_score.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rows, error } = await (sb as any)
    .from("reviews")
    .select("reviewer_user_id, rating, builder:users!builder_id ( vibe_score )")
    .not("reviewer_user_id", "is", null);

  if (error) {
    console.error("reviewer-calibration: fetch failed", error);
    return { updated: 0, skipped: 0 };
  }

  // 2. Pull the global vibe_score distribution to compute percentile.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: allScores } = await (sb as any)
    .from("users")
    .select("vibe_score")
    .gt("vibe_score", 0)
    .order("vibe_score", { ascending: true });

  const scores: number[] = (allScores || []).map((u: { vibe_score: number }) => u.vibe_score);
  const total = scores.length || 1;

  // Percentile: fraction of users with score STRICTLY LESS than this one.
  function percentileFor(score: number): number {
    let count = 0;
    for (const s of scores) {
      if (s < score) count++;
      else break;
    }
    return count / total;
  }

  // 3. Group reviews by reviewer.
  const grouped = new Map<string, Array<{ rating: number; builderPercentile: number }>>();
  for (const r of rows || []) {
    const uid = r.reviewer_user_id as string;
    const builderScore = (r.builder as { vibe_score: number } | null)?.vibe_score ?? 0;
    const list = grouped.get(uid) || [];
    list.push({ rating: r.rating, builderPercentile: percentileFor(builderScore) });
    grouped.set(uid, list);
  }

  // 4. Compute + upsert per reviewer.
  let updated = 0;
  let skipped = 0;

  for (const [reviewerUserId, reviews] of grouped) {
    if (reviews.length < MIN_REVIEWS_FOR_CALIBRATION) { skipped++; continue; }
    const cal = computeCalibration(reviews);
    const tier = classifyTier(cal, reviews.length);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updErr } = await (sb as any)
      .from("users")
      .update({ reviewer_calibration: cal, reviewer_tier: tier })
      .eq("id", reviewerUserId);

    if (updErr) {
      console.error("reviewer-calibration: update failed", reviewerUserId, updErr);
      continue;
    }
    updated++;
  }

  return { updated, skipped };
}
