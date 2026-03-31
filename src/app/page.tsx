import { LiveActivityFeed } from "@/components/ui/live-activity-feed";
import Link from "next/link";
import { VibecoderCard } from "@/components/ui/vibecoder-card";
import { ProjectCard } from "@/components/ui/project-card";
import { HeroCTA } from "@/components/ui/hero-cta";
import { TestimonialScroll } from "@/components/ui/testimonial-scroll";
import { fetchHomepageDataCached } from "@/lib/supabase/server-queries";
import { Flame, TrendingUp, Award, Zap, ArrowRight, Code2, Target, Users } from "lucide-react";

export const revalidate = 60;

const FAQ_ITEMS = [
  {
    q: "What is vibe coding?",
    a: "Vibe coding is the practice of building software using AI-powered IDEs like Claude Code, Cursor, and Bolt. Vibe coders focus on shipping fast, staying in flow state, and building consistently rather than following traditional development processes.",
  },
  {
    q: "How does the VibeTalent vibe score work?",
    a: "The vibe score is a reputation metric calculated from your coding streak (consecutive days of commits), project quality scores, GitHub activity, and peer endorsements. The higher your consistency and quality, the higher your score.",
  },
  {
    q: "What are coding streaks and why do they matter?",
    a: "A coding streak tracks consecutive days you have committed code. Streaks matter because they are an unfakeable signal of consistency. Clients trust developers who show up every day over those with polished resumes but no proof of work.",
  },
  {
    q: "How do VibeTalent badges work?",
    a: "Badges are earned through streak milestones: Bronze at 30 days, Silver at 90 days, Gold at 180 days, and Diamond at 365 days. Each badge level signals increasing dedication and reliability to potential clients.",
  },
  {
    q: "How is VibeTalent different from Upwork or Toptal?",
    a: "Unlike traditional freelancer platforms that rely on resumes and client reviews, VibeTalent ranks developers by verifiable proof of work — coding streaks, shipped projects with live URLs, GitHub activity, and quality scores. You cannot fake a 200-day streak.",
  },
  {
    q: "Is VibeTalent free to use?",
    a: "Yes, creating a profile, building your streak, and getting discovered by clients is completely free. VibeTalent is a marketplace where your work speaks for itself.",
  },
];

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
  } catch (err) {
    console.error("[HomePage] Failed to fetch homepage data:", err);
  }

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "WebSite",
                name: "VibeTalent",
                url: "https://www.vibetalent.work",
                description:
                  "The marketplace for vibe coders who ship consistently. Find developers based on streaks, shipped projects, and vibe scores.",
                potentialAction: {
                  "@type": "SearchAction",
                  target: "https://www.vibetalent.work/explore?q={search_term_string}",
                  "query-input": "required name=search_term_string",
                },
              },
              {
                "@type": "Organization",
                name: "VibeTalent",
                url: "https://www.vibetalent.work",
                logo: "https://www.vibetalent.work/opengraph-image",
                sameAs: [
                  "https://x.com/abhiontwt",
                  "https://github.com/unknownking07/vibe-talent",
                ],
              },
            ],
          }),
        }}
      />

      {/* Hero */}
      <section className="relative">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-24 pb-20 text-center">
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 text-sm font-bold uppercase tracking-wide text-[var(--foreground)] mb-8"
            style={{
              backgroundColor: "var(--bg-surface)",
              border: "2px solid var(--border-hard)",
              boxShadow: "var(--shadow-brutal-sm)",
            }}
          >
            <Flame size={14} className="text-[var(--accent)]" />
            <span>The vibecoders marketplace</span>
          </div>

          <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight uppercase text-[var(--foreground)]">
            Find Vibe Coders Who
            <br />
            <span className="text-accent-brutal">
              Actually Ship.
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-[var(--text-secondary)] font-medium">
            A marketplace built on consistency and proof of work. No resumes. No portfolios.
            Just streaks, shipped projects, and vibe scores.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <HeroCTA />
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
                  backgroundColor: "var(--bg-surface)",
                  border: "2px solid var(--border-hard)",
                  boxShadow: "var(--shadow-brutal-sm)",
                }}
              >
                <stat.icon size={20} className="mx-auto text-[var(--accent)] mb-2" />
                <div className="text-2xl font-extrabold text-[var(--foreground)] font-mono">{stat.value}</div>
                <div className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <LiveActivityFeed />

      {/* What is Vibe Coding */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-extrabold uppercase text-[var(--foreground)]">What is Vibe Coding?</h2>
          <p className="mt-3 text-[var(--text-secondary)] font-medium max-w-2xl mx-auto">
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
              className="card-brutal p-6 transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_var(--border-hard)]"
            >
              <item.icon size={28} className="text-[var(--accent)]" />
              <h3 className="mt-4 text-lg font-extrabold uppercase text-[var(--foreground)]">{item.title}</h3>
              <p className="mt-2 text-sm text-[var(--text-secondary)] font-medium">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Why Streaks Matter */}
      <section
        style={{
          borderTop: "2px solid var(--border-hard)",
          borderBottom: "2px solid var(--border-hard)",
          backgroundColor: "var(--bg-surface)",
        }}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-20">
          <div className="grid sm:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-extrabold uppercase text-[var(--foreground)]">Why Streaks Matter</h2>
              <p className="mt-4 text-[var(--text-secondary)] font-medium leading-relaxed">
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
                      style={{ backgroundColor: "var(--accent)", border: "1px solid var(--border-hard)" }}
                    />
                    <span className="text-sm font-semibold text-[var(--foreground)]">{point}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              {[
                { label: "Bronze Badge", days: 30, color: "#D97706", width: "8%" },
                { label: "Silver Badge", days: 90, color: "var(--text-muted)", width: "25%" },
                { label: "Gold Badge", days: 180, color: "#CA8A04", width: "50%" },
                { label: "Diamond Badge", days: 365, color: "#0891B2", width: "100%" },
              ].map((badge) => (
                <div key={badge.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-bold text-[var(--foreground)] uppercase">{badge.label}</span>
                    <span className="font-bold text-[var(--text-muted)]">{badge.days} days</span>
                  </div>
                  <div
                    className="h-4"
                    style={{ backgroundColor: "var(--border-subtle)", border: "2px solid var(--border-hard)" }}
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
            <h2 className="text-3xl font-extrabold uppercase text-[var(--foreground)]">Top Talent</h2>
            <p className="mt-2 text-[var(--text-secondary)] font-medium">The most consistent builders on the platform</p>
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
            <p className="text-[var(--text-secondary)] font-bold uppercase">No builders yet. Be the first to join!</p>
          </div>
        )}
      </section>

      {/* Featured Projects */}
      <section
        style={{
          borderTop: "2px solid var(--border-hard)",
          backgroundColor: "var(--bg-surface)",
        }}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-20">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-extrabold uppercase text-[var(--foreground)]">Featured Projects</h2>
              <p className="mt-2 text-[var(--text-secondary)] font-medium">Built by vibe coders, shipped fast</p>
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
              <p className="text-[var(--text-secondary)] font-bold uppercase">No projects shipped yet. Start building!</p>
            </div>
          )}
        </div>
      </section>

      {/* Testimonials */}
      <section
        style={{
          borderTop: "2px solid var(--border-hard)",
          backgroundColor: "var(--bg-surface-light)",
        }}
      >
        <div className="py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 mb-8">
            <h2 className="text-3xl font-extrabold uppercase text-[var(--foreground)]">What People Say</h2>
            <p className="mt-2 text-[var(--text-secondary)] font-medium">Real feedback from the community on X</p>
          </div>
          <TestimonialScroll />
        </div>
      </section>

      {/* FAQ */}
      <section
        style={{
          borderTop: "2px solid var(--border-hard)",
        }}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-20">
          <h2 className="text-3xl font-extrabold uppercase text-[var(--foreground)] mb-8">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {FAQ_ITEMS.map((faq) => (
              <div
                key={faq.q}
                className="p-5"
                style={{
                  backgroundColor: "var(--bg-surface)",
                  border: "2px solid var(--border-hard)",
                  boxShadow: "var(--shadow-brutal-sm)",
                }}
              >
                <h3 className="text-base font-extrabold uppercase text-[var(--foreground)]">{faq.q}</h3>
                <p className="mt-2 text-sm text-[var(--text-secondary)] font-medium leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: FAQ_ITEMS.map((faq) => ({
                "@type": "Question",
                name: faq.q,
                acceptedAnswer: { "@type": "Answer", text: faq.a },
              })),
            }),
          }}
        />
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-20">
        <div
          className="p-12 text-center"
          style={{
            backgroundColor: "var(--bg-inverted)",
            border: "2px solid var(--border-hard)",
            boxShadow: "8px 8px 0 var(--accent)",
          }}
        >
          <Zap size={40} className="mx-auto text-[var(--accent)] mb-4" />
          <h2 className="text-3xl sm:text-4xl font-extrabold uppercase text-white">Join the Marketplace</h2>
          <p className="mt-4 text-[var(--text-muted-soft)] font-medium max-w-xl mx-auto">
            Start building your vibe coding reputation today. Create a profile,
            start your streak, and let VibeFinder Bot match you with clients.
          </p>
          <HeroCTA
            className="mt-8 inline-flex"
            style={{ boxShadow: "6px 6px 0 var(--background)" }}
          />
        </div>
      </section>
    </div>
  );
}
