import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { fetchUserByUsernameCached } from "@/lib/supabase/server-queries";
import { fetchAchievementCounters } from "@/lib/achievements/fetch";
import { computeAchievements } from "@/lib/achievements/definitions";
import { AchievementsGrid } from "@/components/achievements/achievements-grid";
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
    return { title: "Achievements" };
  }

  const title = `@${user.username}'s Achievements`;
  const description = `Badges earned by @${user.username} on VibeTalent — streaks, projects, endorsements, and more.`;
  const encodedUsername = encodeURIComponent(user.username);

  return {
    title,
    description,
    alternates: {
      canonical: `${siteUrl}/profile/${encodedUsername}/achievements`,
    },
    openGraph: {
      title,
      description,
      url: `${siteUrl}/profile/${encodedUsername}/achievements`,
      siteName: "VibeTalent",
      type: "profile",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export const revalidate = 3600;

export default async function AchievementsPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username: rawUsername } = await params;
  const username = rawUsername?.trim();

  if (!username || username.length > 50 || !/^[a-zA-Z0-9_.\- ]+$/.test(username)) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-20 text-center">
        <h1 className="text-2xl font-extrabold uppercase text-[var(--foreground)]">
          Invalid username
        </h1>
        <p className="mt-2 font-medium text-[var(--text-secondary)]">
          This is not a valid username.
        </p>
      </div>
    );
  }

  const user = await fetchUserByUsernameCached(username);

  if (!user) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-20 text-center">
        <h1 className="text-2xl font-extrabold uppercase text-[var(--foreground)]">
          Builder not found
        </h1>
        <p className="mt-2 font-medium text-[var(--text-secondary)]">
          @{username} does not exist on VibeTalent.
        </p>
      </div>
    );
  }

  const counters = await fetchAchievementCounters(user);
  const achievements = computeAchievements(counters);
  const earnedCount = achievements.filter((a) => a.earned).length;
  const totalCount = achievements.length;
  const overallPercent = Math.round((earnedCount / totalCount) * 100);

  return (
    <div className="flex justify-center p-4 sm:p-8">
      <div className="w-full max-w-[1200px] flex flex-col gap-6">
        {/* Back to profile */}
        <Link
          href={`/profile/${user.username}`}
          className="inline-flex w-fit items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide"
          style={{ color: "var(--text-secondary)" }}
        >
          <ArrowLeft size={14} strokeWidth={3} />
          Back to @{user.username}
        </Link>

        {/* Header card */}
        <section
          className="p-6"
          style={{
            backgroundColor: "var(--bg-surface)",
            border: "2px solid var(--border-hard)",
            boxShadow: "var(--shadow-brutal)",
          }}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <h1
                className="text-2xl font-extrabold uppercase tracking-wide"
                style={{ color: "var(--foreground)" }}
              >
                Achievements
              </h1>
              <p
                className="text-sm font-medium"
                style={{ color: "var(--text-secondary)" }}
              >
                Badges earned by @{user.username}
              </p>
            </div>
            <div className="flex flex-col items-start gap-1 sm:items-end">
              <div
                className="text-3xl font-extrabold tabular-nums"
                style={{ color: "var(--foreground)" }}
              >
                {earnedCount}
                <span style={{ color: "var(--text-muted)" }}>
                  {" / "}
                  {totalCount}
                </span>
              </div>
              <div
                className="text-[10px] font-extrabold uppercase tracking-wide"
                style={{ color: "var(--text-secondary)" }}
              >
                Unlocked
              </div>
            </div>
          </div>
          <div
            className="mt-5 h-3 w-full overflow-hidden"
            style={{
              backgroundColor: "var(--bg-base)",
              border: "2px solid var(--border-hard)",
            }}
          >
            <div
              className="h-full"
              style={{
                width: `${overallPercent}%`,
                backgroundColor: "var(--badge-gold, #EAB308)",
                transition: "width 200ms ease-out",
              }}
            />
          </div>
        </section>

        {/* Grouped grid */}
        <AchievementsGrid achievements={achievements} username={user.username} />
      </div>
    </div>
  );
}
