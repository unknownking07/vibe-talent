import { fetchAllUsersCached } from "@/lib/supabase/server-queries";
import { ExploreContent } from "@/components/explore/explore-content";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Explore Talent | VibeTalent",
  description:
    "Discover talented vibe coders. Filter by badge level, streak, tech stack, and more to find the perfect builder for your project.",
};

export const dynamic = "force-dynamic";

export default async function ExplorePage() {
  const users = await fetchAllUsersCached();

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://www.vibetalent.work" },
          { "@type": "ListItem", position: 2, name: "Explore Talent", item: "https://vibetalent.work/explore" },
        ],
      },
      {
        "@type": "ItemList",
        name: "VibeTalent Builders",
        description: "Discover talented vibe coders and find the perfect builder for your project",
        numberOfItems: users.length,
        itemListElement: users.slice(0, 10).map((user, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: user.username,
          url: `https://vibetalent.work/profile/${user.username}`,
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
      </div>

      <ExploreContent users={users} />
    </div>
  );
}
