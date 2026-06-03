import Link from "next/link";
import { Users, Code2, Flame, Target, Check } from "lucide-react";
import { HeroCTA } from "@/components/ui/hero-cta";
import { HeroSceneStyles, BuilderScene, HirerScene } from "@/components/homepage/hero-scenes";

interface ForkHeroProps {
  stats: {
    totalBuilders: number;
    totalProjects: number;
    avgStreak: number;
    topVibers: number;
  };
}

export function ForkHero({ stats }: ForkHeroProps) {
  const statItems = [
    { label: "Active Builders", value: String(stats.totalBuilders), icon: Users },
    { label: "Projects Shipped", value: String(stats.totalProjects), icon: Code2 },
    { label: "Avg. Streak", value: `${stats.avgStreak} ${stats.avgStreak === 1 ? "day" : "days"}`, icon: Flame },
    { label: "Top Vibers", value: String(stats.topVibers), icon: Target },
  ];

  return (
    <section className="relative">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-12 pb-10">
        <div className="text-center">
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 text-sm font-bold uppercase tracking-wide text-[var(--foreground)] mb-6"
            style={{ backgroundColor: "var(--bg-surface)", border: "2px solid var(--border-hard)", boxShadow: "var(--shadow-brutal-sm)" }}
          >
            <span>Proof of work, not résumés</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight uppercase text-[var(--foreground)]">
            Vibe coders who <span className="text-accent-brutal">actually ship.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-[var(--text-secondary)] font-medium">
            VibeTalent gives developers a GitHub-verified track record — daily coding streaks, real shipped projects, and one Vibe Score — so the best get discovered and hired on proof, not résumés.
          </p>
        </div>

        {/* The explicit fork — the visitor self-selects */}
        <HeroSceneStyles />
        <div className="mt-10 grid gap-5 sm:grid-cols-2 max-w-4xl mx-auto stagger-children">
          {/* Builder path */}
          <div
            className="p-7 flex flex-col"
            style={{ backgroundColor: "var(--bg-surface)", border: "2px solid var(--border-hard)", boxShadow: "var(--shadow-brutal)" }}
          >
            <BuilderScene />
            <h2 className="mt-5 text-2xl font-extrabold uppercase text-[var(--foreground)]">I&apos;m a builder</h2>
            <p className="mt-2 text-[var(--text-secondary)] font-semibold">Build your reputation. Get discovered.</p>
            <ul className="mt-4 space-y-2">
              {["Daily streaks, verified from GitHub", "Shipped projects with quality scores", "A vibe score that gets you hired"].map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)]">
                  <Check size={16} className="text-[var(--accent)] shrink-0" /> {f}
                </li>
              ))}
            </ul>
            <HeroCTA className="mt-6 inline-flex w-full justify-center" />
          </div>

          {/* Hiring path */}
          <div
            className="p-7 flex flex-col"
            style={{ backgroundColor: "var(--bg-surface)", border: "2px solid var(--border-hard)", boxShadow: "var(--shadow-brutal)" }}
          >
            <HirerScene />
            <h2 className="mt-5 text-2xl font-extrabold uppercase text-[var(--foreground)]">I&apos;m hiring</h2>
            <p className="mt-2 text-[var(--text-secondary)] font-semibold">Hire vibe coders who actually ship.</p>
            <ul className="mt-4 space-y-2">
              {["Ranked by proof of work, not resumes", "Browse by streak, stack & vibe score", "See live projects before you reach out"].map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)]">
                  <Check size={16} className="text-[var(--accent)] shrink-0" /> {f}
                </li>
              ))}
            </ul>
            <Link href="/explore" className="btn-brutal btn-brutal-secondary text-base mt-6 w-full justify-center inline-flex">
              Explore Talent
            </Link>
          </div>
        </div>

        {/* Shared proof strip */}
        <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mx-auto">
          {statItems.map((stat) => (
            <div
              key={stat.label}
              className="text-center p-3"
              style={{ backgroundColor: "var(--bg-surface)", border: "2px solid var(--border-hard)", boxShadow: "var(--shadow-brutal-sm)" }}
            >
              <stat.icon size={18} className="mx-auto text-[var(--accent)] mb-1.5" />
              <div className="text-xl font-extrabold text-[var(--foreground)] font-mono">{stat.value}</div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)] mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
