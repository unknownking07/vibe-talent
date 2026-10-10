import { fetchAllUsersCached } from "@/lib/supabase/server-queries";
import { jsonLdHtml } from "@/lib/json-ld";
import { LeaderboardTabs } from "@/components/leaderboard/leaderboard-tabs";
import { defaultSocialImage, siteUrl, buildBreadcrumbList } from "@/lib/seo";
import type { Metadata } from "next";
import Link from "next/link";
import { Trophy } from "@phosphor-icons/react/dist/ssr";

export const metadata: Metadata = {
  title: "Top Vibe Coders: Developer Leaderboard by Project Evidence",
  description:
    "See the top vibe coders ranked by verified project evidence and community feedback. Commits and streaks add zero score points.",
  alternates: {
    canonical: `${siteUrl}/leaderboard`,
  },
  openGraph: {
    title: "Top Vibe Coders: VibeTalent Leaderboard",
    description: "See the top developers ranked by vibe score from project evidence and community feedback.",
    url: `${siteUrl}/leaderboard`,
    siteName: "VibeTalent",
    type: "website",
    images: [{ url: defaultSocialImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    images: [defaultSocialImage],
    title: "Top Vibe Coders: VibeTalent Leaderboard",
    description: "See the top developers ranked by vibe score from project evidence and community feedback.",
  },
};

// See /explore: rankings shift slowly, so 5 minutes trades no real freshness
// for five times fewer background re-renders.
export const revalidate = 300;

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
      buildBreadcrumbList([
        { name: "Home", path: "/" },
        { name: "Leaderboard", path: "/leaderboard" },
      ]),
      {
        "@type": "ItemList",
        name: "VibeTalent Leaderboard",
        description: "Top vibe coders ranked by vibe score from project evidence and community feedback",
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
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLd) }}
      />
      <div className="text-center mb-10">
        <div
          className="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-2xl border border-[var(--border-subtle)] shadow-[var(--shadow-brutal-sm)]"
          style={{ backgroundColor: "var(--status-warning-bg)" }}
        >
          <Trophy weight="duotone" size={32} className="text-[#CA8A04]" />
        </div>
        <h1 className="text-3xl font-bold text-[var(--foreground)]">Leaderboard</h1>
        <p className="mt-2 text-[var(--text-secondary)] font-medium">Project evidence and community reputation</p>
        <p className="mt-3 text-sm text-[var(--text-muted)] leading-relaxed max-w-2xl mx-auto">
          Commits, contribution totals, streaks and activity badges add zero score points. Vibe score uses the strongest public project with verified GitHub ownership, plus community feedback. Repository checks do not prove working software or client delivery.
        </p>
      </div>

      <div className="mb-8 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 text-sm text-[var(--text-secondary)]">
        <p className="font-semibold text-[var(--foreground)]">Hiring? Start with the work.</p>
        <p className="mt-1">Founder matches use public projects with verified GitHub ownership and inspectable repository signals. Streaks and vibe score add no hiring-score points. Inspect the source and demo, then agree a paid trial directly with the builder.</p>
        <Link href="/agent/find" className="mt-3 inline-block font-semibold text-[var(--accent)]">Find builders by project evidence →</Link>
      </div>

      <LeaderboardTabs users={users} />
    </div>
  );
}
