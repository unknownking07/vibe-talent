import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { extractSocialHandle } from "@/lib/social-handles";
import { getSiteUrl } from "@/lib/seo";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "X-RateLimit-Limit": "100",
  "X-RateLimit-Window": "60",
  "Cache-Control": "public, max-age=60",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    const supabase = await createServerSupabaseClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: user, error } = await (supabase as any)
      .from("users")
      .select("id, username, bio, avatar_url, vibe_score, streak, longest_streak, badge_level, created_at")
      .eq("username", username)
      .single();

    if (error || !user) {
      return NextResponse.json(
        { error: "Builder not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    // Fetch projects, social links, and review aggregates in parallel
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const [
      { data: projects, error: projectsError },
      { data: socialLinks, error: socialLinksError },
      { data: reviews, error: reviewsError },
    ] = await Promise.all([
      (supabase as any)
        .from("projects")
        .select(
          "id, title, description, tech_stack, live_url, github_url, image_url, build_time, tags, verified, quality_score, quality_metrics, live_url_ok, endorsement_count, created_at"
        )
        .eq("user_id", user.id)
        .eq("flagged", false)
        .order("created_at", { ascending: false }),
      (supabase as any)
        .from("social_links")
        .select("twitter, telegram, github, website, farcaster")
        .eq("user_id", user.id)
        .single(),
      (supabase as any)
        .from("reviews")
        .select("rating, trust_score")
        .eq("builder_id", user.id),
    ]);
    /* eslint-enable @typescript-eslint/no-explicit-any */

    if (projectsError) {
      console.error("Failed to fetch projects:", projectsError);
      return NextResponse.json(
        { error: "Failed to fetch projects" },
        { status: 500, headers: corsHeaders }
      );
    }

    if (socialLinksError && socialLinksError.code !== "PGRST116") {
      console.error("Failed to fetch social links:", socialLinksError);
      return NextResponse.json(
        { error: "Failed to fetch social links" },
        { status: 500, headers: corsHeaders }
      );
    }

    if (reviewsError) {
      // Don't silently treat a transient DB failure as "0 trusted reviews" —
      // an agent making a hire decision based on review_count would otherwise
      // see false-zeros that look identical to a builder with no reviews.
      console.error("Failed to fetch reviews:", reviewsError);
      return NextResponse.json(
        { error: "Failed to fetch reviews" },
        { status: 500, headers: corsHeaders }
      );
    }

    // Average only trust-scored reviews (>= 30) to mirror the public profile.
    const trustedReviews = (reviews || []).filter(
      (r: { trust_score?: number | null }) => (r.trust_score ?? 100) >= 30
    );
    const averageRating =
      trustedReviews.length > 0
        ? Math.round(
            (trustedReviews.reduce(
              (sum: number, r: { rating: number }) => sum + r.rating,
              0
            ) /
              trustedReviews.length) *
              10
          ) / 10
        : null;

    const siteUrl = getSiteUrl();
    const builder = {
      username: user.username,
      profile_url: `${siteUrl}/profile/${user.username}`,
      bio: user.bio,
      avatar_url: user.avatar_url,
      vibe_score: user.vibe_score,
      streak: user.streak,
      longest_streak: user.longest_streak,
      badge_level: user.badge_level,
      created_at: user.created_at,
      review_count: trustedReviews.length,
      average_rating: averageRating,
      projects: (projects || []).map(
        (p: {
          id: string;
          title: string;
          description: string;
          tech_stack: string[];
          live_url: string | null;
          github_url: string | null;
          image_url: string | null;
          build_time: string | null;
          tags: string[];
          verified: boolean;
          quality_score: number | null;
          quality_metrics: Record<string, unknown> | null;
          live_url_ok: boolean | null;
          endorsement_count: number;
          created_at: string;
        }) => ({
          id: p.id,
          title: p.title,
          description: p.description,
          tech_stack: p.tech_stack,
          live_url: p.live_url,
          github_url: p.github_url,
          image_url: p.image_url,
          build_time: p.build_time,
          tags: p.tags,
          verified: p.verified,
          quality_score: p.quality_score,
          quality_metrics: p.quality_metrics,
          live_url_ok: p.live_url_ok,
          endorsement_count: p.endorsement_count,
          created_at: p.created_at,
        })
      ),
      social_links: socialLinks
        ? {
            // Always return bare handles so API consumers can build their
            // own URLs without worrying about whether the user pasted a
            // username or a full profile link at signup.
            twitter: extractSocialHandle(socialLinks.twitter, "twitter"),
            telegram: extractSocialHandle(socialLinks.telegram, "telegram"),
            github: socialLinks.github,
            website: socialLinks.website,
            farcaster: socialLinks.farcaster,
          }
        : null,
    };

    return NextResponse.json({ builder }, { headers: corsHeaders });
  } catch (err) {
    console.error("API error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
