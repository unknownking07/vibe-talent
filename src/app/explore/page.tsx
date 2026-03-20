import { fetchAllUsersCached } from "@/lib/supabase/server-queries";
import { ExploreContent } from "@/components/explore/explore-content";

export const dynamic = "force-dynamic";

export default async function ExplorePage() {
  const users = await fetchAllUsersCached();

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold uppercase text-[#0F0F0F]">Explore Talent</h1>
        <p className="mt-2 text-[#52525B] font-medium">
          Discover talented vibe coders and find the perfect builder for your project
        </p>
      </div>

      <ExploreContent users={users} />
    </div>
  );
}
