import { fetchUserByUsernameCached, fetchStreakLogsCached } from "@/lib/supabase/server-queries";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ProfileSidebar } from "@/components/profile/profile-sidebar";
import { StatsRibbon } from "@/components/profile/stats-ribbon";
import { ProfileHeatmap } from "@/components/profile/profile-heatmap";
import { ProfileProjectCard } from "@/components/profile/profile-project-card";
import ReviewsSection from "@/components/profile/reviews-section";
import { ProfileViewTracker } from "@/components/profile/profile-view-tracker";
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

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Explore", item: `${siteUrl}/explore` },
      { "@type": "ListItem", position: 3, name: `@${user.username}`, item: `${siteUrl}/profile/${user.username}` },
    ],
  };

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
      user.social_links?.twitter ? `https://x.com/${user.social_links.twitter}` : null,
      user.social_links?.website || null,
    ].filter(Boolean),
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
        {/* Sidebar */}
        <ProfileSidebar user={user} isOwner={isOwner} />

        {/* Main Content */}
        <div className="flex flex-col gap-6">
          {/* Stats Ribbon */}
          <StatsRibbon
            streak={user.streak}
            vibeScore={user.vibe_score}
            projectCount={(user.projects ?? []).length}
          />

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
          <section>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-extrabold uppercase text-[var(--foreground)]">Featured Projects</h3>
              <span
                className="btn-brutal btn-brutal-dark text-xs py-1.5 px-4 cursor-pointer"
              >
                View All
              </span>
            </div>
            {(user.projects ?? []).length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
                {(user.projects ?? []).map((project) => (
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

          {/* Reviews Section */}
          <ReviewsSection builderId={user.id} isOwner={isOwner} />
        </div>
      </div>
    </div>
  );
}
