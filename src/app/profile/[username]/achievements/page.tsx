import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { fetchUserByUsernameCached } from "@/lib/supabase/server-queries";
import { fetchAchievementCounters } from "@/lib/achievements/fetch";
import { computeAchievements, toAchievementView } from "@/lib/achievements/definitions";
import { AchievementsView } from "@/components/achievements/achievements-view";
import { defaultSocialImage, siteUrl } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username: rawMeta } = await params;
  const username = rawMeta?.trim();
  const user = await fetchUserByUsernameCached(username);

  if (!user) {
    notFound();
  }

  const title = `@${user.username}'s Achievements`;
  const description = `Badges earned by @${user.username} on VibeTalent: streaks, projects, endorsements, and more.`;
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
      images: [{ url: defaultSocialImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      images: [defaultSocialImage],
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
    notFound();
  }

  const user = await fetchUserByUsernameCached(username);

  if (!user) {
    notFound();
  }

  const counters = await fetchAchievementCounters(user);
  const achievements = computeAchievements(counters).map(toAchievementView);

  return (
    <div className="flex justify-center p-4 sm:p-8">
      <div className="w-full max-w-[1200px] flex flex-col gap-6">
        {/* Back to profile */}
        <Link
          href={`/profile/${user.username}`}
          className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold"
          style={{ color: "var(--text-secondary)" }}
        >
          <ArrowLeft size={14} strokeWidth={3} />
          Back to @{user.username}
        </Link>

        <AchievementsView achievements={achievements} username={user.username} />
      </div>
    </div>
  );
}
