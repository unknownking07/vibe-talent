import Link from "next/link";
import { UsersThree, Code, Fire, Target, CheckCircle } from "@phosphor-icons/react/dist/ssr";
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
    { label: "Active Builders", value: String(stats.totalBuilders), icon: UsersThree, accent: false },
    { label: "Projects Shipped", value: String(stats.totalProjects), icon: Code, accent: false },
    { label: "Avg. Streak", value: `${stats.avgStreak} ${stats.avgStreak === 1 ? "day" : "days"}`, icon: Fire, accent: true },
    { label: "Top Vibers", value: String(stats.topVibers), icon: Target, accent: false },
  ];

  return (
    <section className="relative">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-12 pb-10">
        <div className="text-center">
          <p className="text-sm font-medium text-[var(--text-muted)] mb-5">
            The vibe coders marketplace
          </p>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-[var(--foreground)]">
            Vibe coders who <span className="text-accent-brutal">actually ship.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-[var(--text-secondary)] font-medium">
            VibeTalent gives developers a GitHub-verified track record: daily coding streaks, real shipped projects, and one Vibe Score. The best get discovered and hired on proof, not résumés.
          </p>
        </div>

        {/* The explicit fork — the visitor self-selects */}
        <HeroSceneStyles />
        <div className="mt-10 grid gap-5 sm:grid-cols-2 max-w-4xl mx-auto stagger-children">
          {/* Builder path */}
          <div className="card-brutal p-7 flex flex-col">
            <BuilderScene />
            <h2 className="mt-5 text-2xl font-bold text-[var(--foreground)]">I&apos;m a builder</h2>
            <p className="mt-2 text-[var(--text-secondary)] font-semibold">Build your reputation. Get discovered.</p>
            <ul className="mt-4 space-y-2">
              {["Daily streaks, verified from GitHub", "Shipped projects with quality scores", "A vibe score that gets you hired"].map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)]">
                  <CheckCircle size={17} weight="fill" className="text-[var(--accent)] shrink-0" /> {f}
                </li>
              ))}
            </ul>
            <HeroCTA className="mt-6 inline-flex w-full justify-center" />
          </div>

          {/* Hiring path */}
          <div className="card-brutal p-7 flex flex-col">
            <HirerScene />
            <h2 className="mt-5 text-2xl font-bold text-[var(--foreground)]">I&apos;m hiring</h2>
            <p className="mt-2 text-[var(--text-secondary)] font-semibold">Hire vibe coders who actually ship.</p>
            <ul className="mt-4 space-y-2">
              {["Ranked by proof of work, not resumes", "Browse by streak, stack & vibe score", "See live projects before you reach out"].map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)]">
                  <CheckCircle size={17} weight="fill" className="text-[var(--accent)] shrink-0" /> {f}
                </li>
              ))}
            </ul>
            <Link href="/explore" className="btn-brutal btn-brutal-secondary text-base mt-6 w-full justify-center inline-flex">
              Explore Talent
            </Link>
          </div>
        </div>

        {/* Shared proof strip — open numbers, no boxes */}
        <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-8 max-w-3xl mx-auto">
          {statItems.map((stat) => (
            <div key={stat.label} className="text-center">
              <stat.icon
                size={18}
                weight="fill"
                className={`mx-auto mb-2 ${stat.accent ? "text-[var(--accent)]" : "text-[var(--text-muted-soft)]"}`}
              />
              <div className="text-2xl font-bold text-[var(--foreground)] font-mono tracking-tight">{stat.value}</div>
              <div className="text-xs font-medium text-[var(--text-muted)] mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
