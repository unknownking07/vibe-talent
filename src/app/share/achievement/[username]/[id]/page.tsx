import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { fetchUserByUsernameCached } from "@/lib/supabase/server-queries";
import { fetchAchievementCounters } from "@/lib/achievements/fetch";
import { computeAchievements } from "@/lib/achievements/definitions";
import { getBadgeArt } from "@/lib/achievements/badge-art";
import { BadgeMedallion } from "@/components/achievements/badge-medallion";
import { siteUrl } from "@/lib/seo";

interface PageParams {
  params: Promise<{ username: string; id: string }>;
}

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { username, id } = await params;
  const user = await fetchUserByUsernameCached(username);

  if (!user) return { title: "Achievement" };

  const counters = await fetchAchievementCounters(user);
  const achievements = computeAchievements(counters);
  const a = achievements.find((x) => x.id === id);
  if (!a) return { title: "Achievement" };

  const verb = a.earned ? "unlocked" : "is progressing toward";
  const title = `@${user.username} ${verb} "${a.title}"`;
  const description = `${a.description} See @${user.username}'s achievements on VibeTalent.`;
  const encodedUser = encodeURIComponent(user.username);
  const encodedId = encodeURIComponent(a.id);
  const ogUrl = `${siteUrl}/api/og/achievement/${encodedUser}/${encodedId}`;
  const shareUrl = `${siteUrl}/share/achievement/${encodedUser}/${encodedId}`;

  return {
    title,
    description,
    alternates: {
      canonical: shareUrl,
    },
    openGraph: {
      title,
      description,
      url: shareUrl,
      siteName: "VibeTalent",
      type: "article",
      images: [{ url: ogUrl, width: 1200, height: 630, alt: a.title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogUrl],
    },
  };
}

export const revalidate = 3600;

export default async function ShareAchievementPage({ params }: PageParams) {
  const { username: rawUsername, id } = await params;
  const username = rawUsername?.trim();

  if (!username || username.length > 50 || !/^[a-zA-Z0-9_.\- ]+$/.test(username)) {
    return <NotFound />;
  }

  const user = await fetchUserByUsernameCached(username);
  if (!user) return <NotFound />;

  const counters = await fetchAchievementCounters(user);
  const achievements = computeAchievements(counters);
  const achievement = achievements.find((a) => a.id === id);
  if (!achievement) return <NotFound />;

  const art = getBadgeArt(id);

  return (
    <div className="flex justify-center p-4 sm:p-8">
      <div className="w-full max-w-[720px] flex flex-col gap-6">
        <section
          className="flex flex-col items-center gap-6 p-8 text-center sm:p-12"
          style={{
            backgroundColor: "var(--bg-surface)",
            border: "2px solid var(--border-hard)",
            boxShadow: "var(--shadow-brutal)",
          }}
        >
          <div className="mt-2">
            <BadgeMedallion
              paletteKey={art.palette}
              icon={art.icon}
              chipLabel={art.chipLabel}
              size={180}
              earned={achievement.earned}
              animate
            />
          </div>
          <div className="flex flex-col items-center gap-2">
            <span
              className="text-xs font-extrabold uppercase tracking-widest"
              style={{ color: "var(--text-secondary)" }}
            >
              {achievement.category}
            </span>
            <h1
              className="text-3xl font-extrabold uppercase tracking-tight"
              style={{ color: "var(--foreground)" }}
            >
              {achievement.title}
            </h1>
            <p
              className="max-w-md text-sm font-medium leading-relaxed"
              style={{ color: "var(--text-secondary)" }}
            >
              {achievement.description}
            </p>
          </div>
          <div
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-extrabold uppercase tracking-wide"
            style={{
              backgroundColor: achievement.earned
                ? "var(--status-success-bg, #DCFCE7)"
                : "var(--bg-base)",
              color: achievement.earned
                ? "var(--status-success-text, #166534)"
                : "var(--text-muted)",
              border: "2px solid var(--border-hard)",
            }}
          >
            {achievement.earned
              ? `Unlocked by @${user.username}`
              : `${achievement.current} / ${achievement.threshold} ${achievement.unit} · in progress`}
          </div>
        </section>

        <Link
          href={`/profile/${user.username}/achievements`}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-extrabold uppercase tracking-wide"
          style={{
            backgroundColor: "var(--bg-inverted)",
            color: "var(--bg-base)",
            border: "2px solid var(--border-hard)",
            boxShadow: "var(--shadow-brutal-sm)",
          }}
        >
          View all of @{user.username}&apos;s achievements
          <ArrowRight size={16} strokeWidth={3} />
        </Link>
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-20 text-center">
      <h1 className="text-2xl font-extrabold uppercase text-[var(--foreground)]">
        Achievement not found
      </h1>
      <p className="mt-2 font-medium text-[var(--text-secondary)]">
        This achievement link is invalid or has expired.
      </p>
    </div>
  );
}
