import { fetchAllUsersCached } from "@/lib/supabase/server-queries";
import { ExploreContent } from "@/components/explore/explore-content";
import { siteUrl, buildBreadcrumbList } from "@/lib/seo";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Explore Vibe Coders — Browse Developers by Streak & Skills",
  description:
    "Discover talented vibe coders. Filter by badge level, streak, tech stack, and more to find the perfect builder for your project.",
  alternates: {
    canonical: `${siteUrl}/explore`,
  },
  openGraph: {
    title: "Explore Vibe Coders — VibeTalent",
    description: "Browse developers by streak, skills, and vibe score. Find the perfect builder for your project.",
    url: `${siteUrl}/explore`,
    siteName: "VibeTalent",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Explore Vibe Coders — VibeTalent",
    description: "Browse developers by streak, skills, and vibe score. Find the perfect builder for your project.",
  },
};

export const revalidate = 60;

export default async function ExplorePage() {
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
        { name: "Explore Talent", path: "/explore" },
      ]),
      {
        "@type": "ItemList",
        name: "VibeTalent Builders",
        description: "Discover talented vibe coders and find the perfect builder for your project",
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
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold uppercase text-[var(--foreground)]">Explore Talent</h1>
        <p className="mt-2 text-[var(--text-secondary)] font-medium">
          Discover talented vibe coders and find the perfect builder for your project
        </p>
        <p className="mt-3 text-sm text-[var(--text-secondary)] leading-relaxed max-w-3xl">
          Browse our community of vibe coders — developers who prove their skills through daily coding streaks, shipped projects, and peer endorsements. Use the filters below to narrow by tech stack, badge level, or minimum streak length and find the right builder for your next project.
        </p>
      </div>

      <ExploreContent users={users} />
    </div>
  );
}
