import { fetchUserByUsernameCached, fetchStreakLogsCached } from "@/lib/supabase/server-queries";
import { ProfileSidebar } from "@/components/profile/profile-sidebar";
import { StatsRibbon } from "@/components/profile/stats-ribbon";
import { ProfileHeatmap } from "@/components/profile/profile-heatmap";
import { ProfileProjectCard } from "@/components/profile/profile-project-card";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  const user = await fetchUserByUsernameCached(username);

  if (!user) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-20 text-center">
        <h1 className="text-2xl font-extrabold uppercase text-[#0F0F0F]">Builder not found</h1>
        <p className="mt-2 text-[#52525B] font-medium">@{username} does not exist on VibeTalent.</p>
      </div>
    );
  }

  const heatmapData = await fetchStreakLogsCached(user.id);

  return (
    <div className="flex justify-center p-4 sm:p-8">
      <div className="w-full max-w-[1200px] grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 items-start">
        {/* Sidebar */}
        <ProfileSidebar user={user} />

        {/* Main Content */}
        <div className="flex flex-col gap-6">
          {/* Stats Ribbon */}
          <StatsRibbon
            streak={user.streak}
            vibeScore={user.vibe_score}
            projectCount={user.projects.length}
          />

          {/* Heatmap Section */}
          <section
            className="p-6"
            style={{
              backgroundColor: "#FFFFFF",
              border: "2px solid #0F0F0F",
              boxShadow: "var(--shadow-brutal)",
            }}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-extrabold uppercase text-[#0F0F0F]">Contribution Heatmap</h3>
              <Link
                href="/dashboard"
                className="btn-brutal btn-brutal-dark text-xs py-1.5 px-4"
              >
                Log Activity
              </Link>
            </div>
            <ProfileHeatmap data={heatmapData} />
          </section>

          {/* Projects Section */}
          <section>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-extrabold uppercase text-[#0F0F0F]">Featured Projects</h3>
              <span
                className="btn-brutal btn-brutal-dark text-xs py-1.5 px-4 cursor-pointer"
              >
                View All
              </span>
            </div>
            {user.projects.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
                {user.projects.map((project) => (
                  <ProfileProjectCard key={project.id} project={project} verified={!!(project as any).verified} />
                ))}
              </div>
            ) : (
              <div
                className="p-8 text-center font-bold uppercase text-[#71717A]"
                style={{
                  backgroundColor: "#FFFFFF",
                  border: "2px solid #0F0F0F",
                }}
              >
                No projects yet.
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
