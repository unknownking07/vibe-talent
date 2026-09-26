import { fetchUserByUsernameCached, fetchStreakLogsCached } from "@/lib/supabase/server-queries";
import { jsonLdHtml } from "@/lib/json-ld";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProfileSidebar } from "@/components/profile/profile-sidebar";
import { ProfileHeatmap } from "@/components/profile/profile-heatmap";
import { ReviewerStats } from "@/components/profile/reviewer-stats";
import { AchievementsTeaser } from "@/components/achievements/achievements-teaser";
import { fetchAchievementCounters } from "@/lib/achievements/fetch";
import { computeAchievements } from "@/lib/achievements/definitions";
import type { ReviewerTier } from "@/lib/reviewer/tier";
import { extractSocialHandle } from "@/lib/social-handles";
import { ProfileOwnerProvider, ProfileProjects, ProfileStatsRibbon } from "@/components/profile/profile-projects";
import ReviewsSection from "@/components/profile/reviews-section";
import { BackedBy } from "@/components/profile/backed-by";
import { BagsLaunches } from "@/components/profile/bags-launches";
import { ProfileViewTracker } from "@/components/profile/profile-view-tracker";
import { ShareButton } from "@/components/share/share-button";
import Link from "next/link";
import type { Metadata } from "next";
import { siteUrl } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username: rawMeta } = await params;
  const username = rawMeta?.trim();
  const user = await fetchUserByUsernameCached(username);

  if (!user) {
    return { title: "Builder Not Found" };
  }

  const title = `@${user.username}: Vibe Coder`;
  const description = user.bio
    ? `${user.bio.slice(0, 150)} | ${user.streak}-day streak, ${(user.projects ?? []).length} projects`
    : `${user.streak}-day streak, ${(user.projects ?? []).length} projects on VibeTalent`;

  return {
    title,
    description,
    alternates: {
      canonical: `${siteUrl}/profile/${username}`,
    },
    openGraph: {
      title,
      description,
      url: `${siteUrl}/profile/${username}`,
      siteName: "VibeTalent",
      type: "profile",
      images: [
        {
          url: `${siteUrl}/profile/${username}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: `@${username} on VibeTalent`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${siteUrl}/profile/${username}/opengraph-image`],
    },
  };
}

export const revalidate = 300;

// Generate each public profile on first visit, then serve it from ISR. Owner
// controls load in the browser and never enter this shared HTML response.
export async function generateStaticParams() {
  return [];
}

async function fetchReviewerMetrics(userId: string): Promise<{
  reviewsLast30d: number;
  calibration: number | null;
  tier: ReviewerTier | null;
}> {
  const sb = createAdminClient();
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 30);

  const [recent, reputation] = await Promise.all([
    sb.from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("reviewer_user_id", userId)
      .gte("created_at", since.toISOString()),
    sb.from("users")
      .select("reviewer_calibration, reviewer_tier")
      .eq("id", userId)
      .single(),
  ]);

  return {
    reviewsLast30d: recent.count ?? 0,
    calibration: reputation.data?.reviewer_calibration ?? null,
    tier: (reputation.data?.reviewer_tier ?? null) as ReviewerTier | null,
  };
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username: rawUsername } = await params;
  const username = rawUsername?.trim();

  // Validate username format to prevent unnecessary DB queries
  if (!username || username.length > 50 || !/^[a-zA-Z0-9_.\- ]+$/.test(username)) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-20 text-center">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Invalid username</h1>
        <p className="mt-2 text-[var(--text-secondary)] font-medium">This is not a valid username.</p>
      </div>
    );
  }

  const user = await fetchUserByUsernameCached(username);

  if (!user) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-20 text-center">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Builder not found</h1>
        <p className="mt-2 text-[var(--text-secondary)] font-medium">@{username} does not exist on VibeTalent.</p>
      </div>
    );
  }

  // These public reads are independent. Running them together removes two
  // sequential Supabase round trips from a cold profile render.
  const [heatmapData, achievementCounters, reviewerMetrics] = await Promise.all([
    fetchStreakLogsCached(user.id),
    fetchAchievementCounters(user).catch((err) => {
      console.error("[profile] achievements compute failed:", err);
      return null;
    }),
    fetchReviewerMetrics(user.id).catch((err) => {
      console.error("Failed to fetch reviewer reputation:", err);
      return { reviewsLast30d: 0, calibration: null, tier: null };
    }),
  ]);
  const achievements = achievementCounters
    ? computeAchievements(achievementCounters)
    : [];

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Explore", item: `${siteUrl}/explore` },
      { "@type": "ListItem", position: 3, name: `@${user.username}`, item: `${siteUrl}/profile/${user.username}` },
    ],
  };

  const twitterHandle = extractSocialHandle(user.social_links?.twitter, "twitter");
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": `${siteUrl}/profile/${user.username}#person`,
    name: user.username,
    url: `${siteUrl}/profile/${user.username}`,
    ...(user.avatar_url ? { image: user.avatar_url } : {}),
    description: user.bio || `Builder on VibeTalent with a ${user.streak}-day streak`,
    jobTitle: "Software Developer",
    sameAs: [
      user.social_links?.github ? `https://github.com/${user.social_links.github}` : null,
      twitterHandle ? `https://x.com/${twitterHandle}` : null,
      user.social_links?.website || null,
    ].filter((v): v is string => Boolean(v)),
    knowsAbout: (user.projects ?? []).flatMap((p: { tech_stack: string[] }) => p.tech_stack ?? []).filter((v: string, i: number, a: string[]) => a.indexOf(v) === i),
  };

  return (
    <div className="flex justify-center p-4 sm:p-8">
      <ProfileViewTracker viewedUserId={user.id} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(breadcrumbLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLd) }}
      />
      <ProfileOwnerProvider builderId={user.id}>
      <div className="w-full max-w-[1200px] grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 items-start">
        {/* Sidebar column — primary profile sidebar + reviewer reputation block */}
        <div className="flex flex-col gap-6">
          <ProfileSidebar user={user} />
          <ReviewerStats
            reviewsGiven={achievementCounters?.reviewsGiven ?? 0}
            reviewsLast30d={reviewerMetrics.reviewsLast30d}
            calibration={reviewerMetrics.calibration}
            tier={reviewerMetrics.tier}
          />
        </div>

        {/* Main Content */}
        <div className="flex flex-col gap-6">
          {/* Share Receipt */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-bold text-[var(--foreground)]">
              Share @{user.username}&apos;s receipt
            </h2>
            <ShareButton
              url={`/share/${user.username}/custom?range=30d`}
              text={`Check out @${user.username} on VibeTalent`}
              imageUrl={`/api/og/receipt/custom/${user.username}?range=30d`}
            />
          </div>

          {/* Stats Ribbon */}
          <ProfileStatsRibbon
            streak={user.streak}
            vibeScore={user.vibe_score}
            publicProjectCount={(user.projects ?? []).length}
          />

          {/* Achievements Teaser */}
          <AchievementsTeaser achievements={achievements} username={user.username} />

          {/* Heatmap Section */}
          <section
            className="p-6 rounded-2xl"
            style={{
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              boxShadow: "var(--shadow-brutal)",
            }}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-[var(--foreground)]">Contribution Heatmap</h3>
              <Link
                href="/dashboard"
                className="btn-brutal btn-brutal-dark text-xs py-1.5 px-4"
              >
                Log Activity
              </Link>
            </div>
            <ProfileHeatmap data={heatmapData} githubUsername={user.social_links?.github} />
          </section>

          {/* Shows backers when they exist, and otherwise invites the first
              vouch — without the empty state the feature is unreachable on a
              platform where nobody has vouched yet. */}
          <BackedBy builderId={user.id} builderUsername={user.username} />

          {/* Sits directly under Backed by: both answer "has anyone put
              something real behind this person", one in burned tokens and one
              in shipped launches. */}
          <BagsLaunches builderId={user.id} />

          {/* Projects Section */}
          <section>
            <ProfileProjects
              username={user.username}
              publicProjects={user.projects ?? []}
              variant="preview"
            />
          </section>

          {/* Reviews Section */}
          <ReviewsSection builderId={user.id} />
        </div>
      </div>
      </ProfileOwnerProvider>
    </div>
  );
}
