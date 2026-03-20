import { fetchAllUsersCached } from "@/lib/supabase/server-queries";
import { LeaderboardContent } from "@/components/leaderboard/leaderboard-content";
import { Trophy } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const users = await fetchAllUsersCached();

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
      <div className="text-center mb-10">
        <div
          className="inline-flex items-center justify-center w-16 h-16 mb-4"
          style={{
            backgroundColor: "#FEF9C3",
            border: "2px solid #0F0F0F",
            boxShadow: "var(--shadow-brutal)",
          }}
        >
          <Trophy size={32} className="text-[#CA8A04]" />
        </div>
        <h1 className="text-3xl font-extrabold uppercase text-[#0F0F0F]">Leaderboard</h1>
        <p className="mt-2 text-[#52525B] font-medium">The most consistent builders on the platform</p>
      </div>

      <LeaderboardContent users={users} />
    </div>
  );
}
