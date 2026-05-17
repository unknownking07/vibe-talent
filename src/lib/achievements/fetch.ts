/**
 * Server-side aggregator that turns a user + their data into the counters
 * needed to compute achievement states.
 *
 * Most counters come from data already on the cached UserWithSocials shape;
 * only hire_requests and reviews need extra queries.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { UserWithSocials } from "@/lib/types/database";
import type { AchievementCounters } from "@/lib/achievements/definitions";

export async function fetchAchievementCounters(
  user: UserWithSocials
): Promise<AchievementCounters> {
  const projects = user.projects ?? [];

  const projectCount = projects.length;
  const verifiedProjectCount = projects.filter((p) => p.verified).length;
  const topQualityScore = projects.reduce(
    (max, p) => Math.max(max, p.quality_score ?? 0),
    0
  );
  const endorsementsReceived = projects.reduce(
    (sum, p) => sum + (p.endorsement_count ?? 0),
    0
  );

  const hasGithubLinked = Boolean(
    user.github_username || user.social_links?.github
  );

  let hireRequestsReceived = 0;
  let completedHires = 0;
  let reviewsGiven = 0;
  let referralCount = 0;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any;

    const [hireAll, hireReplied, reviewsCount, userRow] = await Promise.all([
      sb
        .from("hire_requests")
        .select("id", { count: "exact", head: true })
        .eq("builder_id", user.id),
      sb
        .from("hire_requests")
        .select("id", { count: "exact", head: true })
        .eq("builder_id", user.id)
        .eq("status", "replied"),
      sb
        .from("reviews")
        .select("id", { count: "exact", head: true })
        .eq("reviewer_user_id", user.id),
      sb
        .from("users")
        .select("referral_count")
        .eq("id", user.id)
        .single(),
    ]);

    // supabase-js v2 resolves with {data, error, count} — it doesn't throw
    // on RLS/SQL errors. Check each .error explicitly and log; fall back
    // to 0 so a partial outage on one counter doesn't zero out the rest.
    if (hireAll?.error) {
      console.error("[achievements] hire_requests count failed:", hireAll.error);
    } else {
      hireRequestsReceived = hireAll?.count ?? 0;
    }
    if (hireReplied?.error) {
      console.error("[achievements] hire_replied count failed:", hireReplied.error);
    } else {
      completedHires = hireReplied?.count ?? 0;
    }
    if (reviewsCount?.error) {
      console.error("[achievements] reviews count failed:", reviewsCount.error);
    } else {
      reviewsGiven = reviewsCount?.count ?? 0;
    }
    if (userRow?.error) {
      console.error("[achievements] referral_count lookup failed:", userRow.error);
    } else {
      referralCount = userRow?.data?.referral_count ?? 0;
    }
  } catch (err) {
    // Only thrown errors (network, client init) land here — query-level
    // errors are already handled above. Fall through with zeros so the
    // page still renders.
    console.error("[achievements] counter fetch failed:", err);
  }

  return {
    longestStreak: user.longest_streak ?? 0,
    projectCount,
    verifiedProjectCount,
    topQualityScore,
    endorsementsReceived,
    hireRequestsReceived,
    completedHires,
    reviewsGiven,
    hasGithubLinked,
    referralCount,
    joinedAt: user.created_at ?? null,
  };
}
