import { fetchAllUsersCached } from "@/lib/supabase/server-queries";
import { LeaderboardContent } from "@/components/leaderboard/leaderboard-content";
import { siteUrl } from "@/lib/seo";
import { Trophy } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Top Vibe Coders — Developer Leaderboard by Streak & Score",
  description:
    "See the top vibe coders ranked by vibe score, streak, and projects shipped. The most consistent builders on the platform.",
  alternates: {
    canonical: `${siteUrl}/leaderboard`,
  },
  openGraph: {
    title: "Top Vibe Coders — VibeTalent Leaderboard",
    description: "See the top developers ranked by vibe score, coding streak, and projects shipped.",
    url: `${siteUrl}/leaderboard`,
    siteName: "VibeTalent",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Top Vibe Coders — VibeTalent Leaderboard",
    description: "See the top developers ranked by vibe score, coding streak, and projects shipped.",
  },
};

export const revalidate = 60;

export default async function LeaderboardPage() {
  let users: Awaited<ReturnType<typeof fetchAllUsersCached>>;
  try {
    users = await fetchAllUsersCached();
  } catch {
    users = [];
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
          { "@type": "ListItem", position: 2, name: "Leaderboard", item: `${siteUrl}/leaderboard` },
        ],
      },
      {
        "@type": "ItemList",
        name: "VibeTalent Leaderboard",
        description: "Top vibe coders ranked by vibe score, streak, and projects shipped",
        numberOfItems: users.length,
        itemListElement: users.slice(0, 10).map((user, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: user.username,
          url: `${siteUrl}/profile/${user.username}`,
        })),
      },
    ],
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="text-center mb-10">
        <div
          className="inline-flex items-center justify-center w-16 h-16 mb-4"
          style={{
            backgroundColor: "var(--status-warning-bg)",
            border: "2px solid var(--border-hard)",
            boxShadow: "var(--shadow-brutal)",
          }}
        >
          <Trophy size={32} className="text-[#CA8A04]" />
        </div>
        <h1 className="text-3xl font-extrabold uppercase text-[var(--foreground)]">Leaderboard</h1>
        <p className="mt-2 text-[var(--text-secondary)] font-medium">The most consistent builders on the platform</p>
        <p className="mt-3 text-sm text-[var(--text-secondary)] leading-relaxed max-w-2xl mx-auto">
          The VibeTalent leaderboard ranks developers by their vibe score — a reputation metric calculated from coding streaks, project quality, GitHub activity, and community endorsements. The most consistent builders rise to the top, proving their dedication through daily shipping.
        </p>
      </div>

      <LeaderboardContent users={users} />
    </div>
  );
}
