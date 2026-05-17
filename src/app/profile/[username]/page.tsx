import { fetchUserByUsernameCached, fetchStreakLogsCached } from "@/lib/supabase/server-queries";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProfileSidebar } from "@/components/profile/profile-sidebar";
import { StatsRibbon } from "@/components/profile/stats-ribbon";
import { ProfileHeatmap } from "@/components/profile/profile-heatmap";
import { ReviewerStats } from "@/components/profile/reviewer-stats";
import { AchievementsTeaser } from "@/components/achievements/achievements-teaser";
import { fetchAchievementCounters } from "@/lib/achievements/fetch";
import { computeAchievements } from "@/lib/achievements/definitions";
import type { ReviewerTier } from "@/lib/reviewer/tier";
import { extractSocialHandle } from "@/lib/social-handles";
import { ProfileProjectCard } from "@/components/profile/profile-project-card";
import ReviewsSection from "@/components/profile/reviews-section";
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

  const title = `@${user.username} — VibeTalent`;
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

export const revalidate = 3600; // ISR: regenerate at most every hour

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
        <h1 className="text-2xl font-extrabold uppercase text-[var(--foreground)]">Invalid username</h1>
        <p className="mt-2 text-[var(--text-secondary)] font-medium">This is not a valid username.</p>
      </div>
    );
  }

  const user = await fetchUserByUsernameCached(username);

  if (!user) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-20 text-center">
        <h1 className="text-2xl font-extrabold uppercase text-[var(--foreground)]">Builder not found</h1>
        <p className="mt-2 text-[var(--text-secondary)] font-medium">@{username} does not exist on VibeTalent.</p>
      </div>
    );
  }

  const heatmapData = await fetchStreakLogsCached(user.id);

  // Achievements are non-core to profile rendering — if the aggregator
  // fails (Supabase blip, etc.) we still want the profile page to load.
  let achievements: ReturnType<typeof computeAchievements> = [];
  try {
    const achievementCounters = await fetchAchievementCounters(user);
    achievements = computeAchievements(achievementCounters);
  } catch (err) {
    console.error("[profile] achievements compute failed:", err);
  }

  // Fetch reviewer reputation data — kept outside the cached user fetch so we
  // don't bust the per-username cache when only review counts change.
  let reviewsGiven = 0;
  let reviewsLast30d = 0;
  let reviewerCalibration: number | null = null;
  let reviewerTier: ReviewerTier | null = null;
  try {
    const adminSb = createAdminClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count: givenCount } = await (adminSb as any)
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("reviewer_user_id", user.id);
    reviewsGiven = givenCount ?? 0;

    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 30);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count: last30Count } = await (adminSb as any)
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("reviewer_user_id", user.id)
      .gte("created_at", since.toISOString());
    reviewsLast30d = last30Count ?? 0;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rep } = await (adminSb as any)
      .from("users")
      .select("reviewer_calibration, reviewer_tier")
      .eq("id", user.id)
      .single();
    reviewerCalibration = rep?.reviewer_calibration ?? null;
    reviewerTier = (rep?.reviewer_tier ?? null) as ReviewerTier | null;
  } catch (err) {
    // Reviewer reputation is non-critical — fall through with zeros/nulls so
    // the profile page still renders if Supabase is briefly unavailable.
    console.error("Failed to fetch reviewer reputation:", err);
  }

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

  // Check if the logged-in user is viewing their own profile
  let isOwner = false;
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    isOwner = authUser?.id === user.id;
  } catch {
    // Not logged in — isOwner stays false
  }

  return (
    <div className="flex justify-center p-4 sm:p-8">
      {!isOwner && <ProfileViewTracker viewedUserId={user.id} />}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="w-full max-w-[1200px] grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 items-start">
        {/* Sidebar column — primary profile sidebar + reviewer reputation block */}
        <div className="flex flex-col gap-6">
          <ProfileSidebar user={user} />
          <ReviewerStats
            reviewsGiven={reviewsGiven}
            reviewsLast30d={reviewsLast30d}
            calibration={reviewerCalibration}
            tier={reviewerTier}
          />
        </div>

        {/* Main Content */}
        <div className="flex flex-col gap-6">
          {/* Share Receipt */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-extrabold uppercase text-[var(--foreground)]">
              Share @{user.username}&apos;s receipt
            </h2>
            <ShareButton
              url={`/share/${user.username}/custom?range=30d`}
              text={`Check out @${user.username} on VibeTalent`}
              imageUrl={`/api/og/receipt/custom/${user.username}?range=30d`}
            />
          </div>

          {/* Stats Ribbon */}
          <StatsRibbon
            streak={user.streak}
            vibeScore={user.vibe_score}
            projectCount={(user.projects ?? []).length}
          />

          {/* Achievements Teaser */}
          <AchievementsTeaser achievements={achievements} username={user.username} />

          {/* Heatmap Section */}
          <section
            className="p-6"
            style={{
              backgroundColor: "var(--bg-surface)",
              border: "2px solid var(--border-hard)",
              boxShadow: "var(--shadow-brutal)",
            }}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-extrabold uppercase text-[var(--foreground)]">Contribution Heatmap</h3>
              <Link
                href="/dashboard"
                className="btn-brutal btn-brutal-dark text-xs py-1.5 px-4"
              >
                Log Activity
              </Link>
            </div>
            <ProfileHeatmap data={heatmapData} githubUsername={user.social_links?.github} />
          </section>

          {/* Projects Section */}
          {(() => {
            const allProjects = user.projects ?? [];
            const visibleProjects = allProjects.slice(0, 4);
            const hasMore = allProjects.length > 4;
            return (
              <section>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-base font-extrabold uppercase text-[var(--foreground)]">Featured Projects</h3>
                  {hasMore && (
                    <Link
                      href={`/profile/${user.username}/projects`}
                      className="btn-brutal btn-brutal-dark text-xs py-1.5 px-4"
                    >
                      View All ({allProjects.length})
                    </Link>
                  )}
                </div>
                {visibleProjects.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
                    {visibleProjects.map((project) => (
                      <ProfileProjectCard key={project.id} project={project} verified={!!project.verified} isOwner={isOwner} />
                    ))}
                  </div>
                ) : (
                  <div
                    className="p-8 text-center font-bold uppercase text-[var(--text-muted)]"
                    style={{
                      backgroundColor: "var(--bg-surface)",
                      border: "2px solid var(--border-hard)",
                    }}
                  >
                    No projects yet.
                  </div>
                )}
              </section>
            );
          })()}

          {/* Reviews Section */}
          <ReviewsSection builderId={user.id} isOwner={isOwner} />
        </div>
      </div>
    </div>
  );
}
