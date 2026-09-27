import { createAdminClient } from "@/lib/supabase/admin";
import type { PublicReview } from "@/lib/types/database";

export type PublicReviewsResult = {
  reviews: PublicReview[];
  average_rating: number;
  total_reviews: number;
  trusted_reviews: number;
};

/** Shared public read for the profile stream and the post-mutation refresh API. */
export async function fetchPublicReviews(builderId: string): Promise<PublicReviewsResult> {
  const sb = createAdminClient();
  // Select only fields safe to return. reviewer_email is private and must not
  // enter a serialized Server Component payload or an API response.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any)
    .from("reviews")
    .select(`
      id, builder_id, reviewer_name, rating, comment, trust_score, created_at, reviewer_user_id,
      reviewer:users!reviewer_user_id ( username, reviewer_calibration, reviewer_tier )
    `)
    .eq("builder_id", builderId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch reviews: ${error.message}`);

  const rows = (data ?? []) as (PublicReview & { trust_score: number | null })[];
  const trusted = rows.filter((review) => (review.trust_score ?? 100) >= 30);
  const average = trusted.length
    ? Math.round((trusted.reduce((sum, review) => sum + review.rating, 0) / trusted.length) * 10) / 10
    : 0;

  return {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    reviews: rows.map(({ trust_score: _trustScore, ...review }) => review),
    average_rating: average,
    total_reviews: rows.length,
    trusted_reviews: trusted.length,
  };
}
