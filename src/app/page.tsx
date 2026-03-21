import Link from "next/link";
import { VibecoderCard } from "@/components/ui/vibecoder-card";
import { ProjectCard } from "@/components/ui/project-card";
import { fetchHomepageDataCached } from "@/lib/supabase/server-queries";
import { Flame, TrendingUp, Award, Zap, ArrowRight, Code2, Target, Users } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let topVibecoders: import("@/lib/types/database").UserWithSocials[] = [];
  let featuredProjects: import("@/lib/types/database").Project[] = [];
  let totalBuilders = 0;
  let totalProjects = 0;
  let avgStreak = 0;

  try {
    const data = await fetchHomepageDataCached();
    topVibecoders = data.topVibecoders;
    featuredProjects = data.featuredProjects;
    totalBuilders = data.totalBuilders;
    totalProjects = data.totalProjects;
    avgStreak = data.avgStreak;
  } catch {
    // Supabase not configured, show empty state
  }

  return (
    <div>
      {/* Hero */}
      <section className="relative">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-24 pb-20 text-center">
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 text-sm font-bold uppercase tracking-wide text-[#0F0F0F] mb-8"
            style={{
              backgroundColor: "#FFFFFF",
              border: "2px solid #0F0F0F",
              boxShadow: "var(--shadow-brutal-sm)",
            }}
          >
            <Flame size={14} className="text-[var(--accent)]" />
            <span>The AI-powered vibecoders marketplace</span>
          </div>

          <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight uppercase text-[#0F0F0F]">
            Find Vibe Coders Who
            <br />
            <span className="text-accent-brutal">
              Actually Ship.
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-[#52525B] font-medium">
            A marketplace built on consistency and proof of work. No resumes. No portfolios.
            Just streaks, shipped projects, and vibe scores.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/dashboard"
              className="btn-brutal btn-brutal-primary text-base flex items-center gap-2"
            >
              Create Your Profile
              <ArrowRight size={18} />
            </Link>
            <Link
              href="/explore"
              className="btn-brutal btn-brutal-secondary text-base"
            >
              Explore Talent
            </Link>
          </div>

          {/* Stats */}
          <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto stagger-children">
            {[
              { label: "Active Builders", value: String(totalBuilders), icon: Users },
              { label: "Projects Shipped", value: String(totalProjects), icon: Code2 },
              { label: "Avg. Streak", value: `${avgStreak} ${avgStreak === 1 ? "day" : "days"}`, icon: Flame },
              { label: "Top Vibers", value: String(topVibecoders.length), icon: Target },
            ].map((stat) => (
              <div
                key={stat.label}
                className="text-center p-4"
                style={{
                  backgroundColor: "#FFFFFF",
                  border: "2px solid #0F0F0F",
                  boxShadow: "var(--shadow-brutal-sm)",
                }}
              >
                <stat.icon size={20} className="mx-auto text-[var(--accent)] mb-2" />
                <div className="text-2xl font-extrabold text-[#0F0F0F] font-mono">{stat.value}</div>
                <div className="text-xs font-bold uppercase tracking-wide text-[#71717A] mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What is Vibe Coding */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-extrabold uppercase text-[#0F0F0F]">What is Vibe Coding?</h2>
          <p className="mt-3 text-[#52525B] font-medium max-w-2xl mx-auto">
            Vibe coding is the art of building software in flow state — shipping fast,
            staying consistent, and letting the code speak for itself.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-6">
          {[
            {
              icon: Flame,
              title: "Ship Every Day",
              description: "Build a streak by coding and shipping consistently. Your streak is your proof of commitment.",
            },
            {
              icon: TrendingUp,
              title: "Build Your Score",
              description: "Your Vibe Score combines streaks, projects, and badges into a single reputation metric.",
            },
            {
              icon: Award,
              title: "Earn Badges",
              description: "Unlock Bronze, Silver, Gold, and Diamond badges as your streak grows. Proof of consistency.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="card-brutal p-6 transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_#0F0F0F]"
            >
              <item.icon size={28} className="text-[var(--accent)]" />
              <h3 className="mt-4 text-lg font-extrabold uppercase text-[#0F0F0F]">{item.title}</h3>
              <p className="mt-2 text-sm text-[#52525B] font-medium">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Why Streaks Matter */}
      <section
        style={{
          borderTop: "2px solid #0F0F0F",
          borderBottom: "2px solid #0F0F0F",
          backgroundColor: "#FFFFFF",
        }}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-20">
          <div className="grid sm:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-extrabold uppercase text-[#0F0F0F]">Why Streaks Matter</h2>
              <p className="mt-4 text-[#52525B] font-medium leading-relaxed">
                Anyone can build a portfolio in a weekend. But maintaining a 90-day coding streak?
                That takes real dedication. Streaks prove you are not just talented — you are consistent.
              </p>
              <div className="mt-6 space-y-3">
                {[
                  "Consistency beats talent in the long run",
                  "Streaks show discipline, not just skill",
                  "Clients want builders who show up every day",
                  "Your streak is your unfakeable resume",
                ].map((point) => (
                  <div key={point} className="flex items-center gap-3">
                    <div
                      className="h-3 w-3 shrink-0"
                      style={{ backgroundColor: "var(--accent)", border: "1px solid #0F0F0F" }}
                    />
                    <span className="text-sm font-semibold text-[#0F0F0F]">{point}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              {[
                { label: "Bronze Badge", days: 30, color: "#D97706", width: "8%" },
                { label: "Silver Badge", days: 90, color: "#71717A", width: "25%" },
                { label: "Gold Badge", days: 180, color: "#CA8A04", width: "50%" },
                { label: "Diamond Badge", days: 365, color: "#0891B2", width: "100%" },
              ].map((badge) => (
                <div key={badge.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-bold text-[#0F0F0F] uppercase">{badge.label}</span>
                    <span className="font-bold text-[#71717A]">{badge.days} days</span>
                  </div>
                  <div
                    className="h-4"
                    style={{ backgroundColor: "#E5E5E5", border: "2px solid #0F0F0F" }}
                  >
                    <div
                      className="h-full"
                      style={{ backgroundColor: badge.color, width: badge.width }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Top Vibecoders */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-20">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-extrabold uppercase text-[#0F0F0F]">Top Talent</h2>
            <p className="mt-2 text-[#52525B] font-medium">The most consistent builders on the platform</p>
          </div>
          <Link
            href="/leaderboard"
            className="flex items-center gap-1 text-sm font-bold uppercase text-[var(--accent)] hover:underline transition-colors"
          >
            View Leaderboard <ArrowRight size={14} />
          </Link>
        </div>

        {topVibecoders.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children">
            {topVibecoders.map((user, i) => (
              <VibecoderCard key={user.id} user={user} rank={i + 1} />
            ))}
          </div>
        ) : (
          <div className="card-brutal p-8 text-center">
            <p className="text-[#52525B] font-bold uppercase">No builders yet. Be the first to join!</p>
          </div>
        )}
      </section>

      {/* Featured Projects */}
      <section
        style={{
          borderTop: "2px solid #0F0F0F",
          backgroundColor: "#FFFFFF",
        }}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-20">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-extrabold uppercase text-[#0F0F0F]">Featured Projects</h2>
              <p className="mt-2 text-[#52525B] font-medium">Built by vibe coders, shipped fast</p>
            </div>
            <Link
              href="/explore"
              className="flex items-center gap-1 text-sm font-bold uppercase text-[var(--accent)] hover:underline transition-colors"
            >
              See All <ArrowRight size={14} />
            </Link>
          </div>

          {featuredProjects.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {featuredProjects.map((project: any) => (
                <ProjectCard key={project.id} project={project} verified={!!project.verified} authorUsername={project.users?.username} />
              ))}
            </div>
          ) : (
            <div className="card-brutal p-8 text-center">
              <p className="text-[#52525B] font-bold uppercase">No projects shipped yet. Start building!</p>
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-20">
        <div
          className="p-12 text-center"
          style={{
            backgroundColor: "#0F0F0F",
            border: "2px solid #0F0F0F",
            boxShadow: "8px 8px 0 var(--accent)",
          }}
        >
          <Zap size={40} className="mx-auto text-[var(--accent)] mb-4" />
          <h2 className="text-3xl sm:text-4xl font-extrabold uppercase text-white">Join the Marketplace</h2>
          <p className="mt-4 text-zinc-400 font-medium max-w-xl mx-auto">
            Start building your vibe coding reputation today. Create a profile,
            start your streak, and let AI agents match you with clients.
          </p>
          <Link
            href="/dashboard"
            className="btn-brutal btn-brutal-primary mt-8 text-base inline-flex items-center gap-2"
            style={{ boxShadow: "6px 6px 0 #FFFFFF" }}
          >
            Create Your Profile
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </div>
  );
}
