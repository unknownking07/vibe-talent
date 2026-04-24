import { LiveActivityFeed } from "@/components/ui/live-activity-feed";
import { FeaturedCarousel } from "@/components/ui/featured-carousel";
import Link from "next/link";
import { VibecoderCard } from "@/components/ui/vibecoder-card";
import { ProjectCard } from "@/components/ui/project-card";
import { HeroCTA } from "@/components/ui/hero-cta";
import { TestimonialScroll } from "@/components/ui/testimonial-scroll";
import { fetchHomepageDataCached } from "@/lib/supabase/server-queries";
import { siteUrl } from "@/lib/seo";
import { Flame, TrendingUp, Award, Zap, ArrowRight, Code2, Target, Users } from "lucide-react";

export const revalidate = 60;

const FAQ_ITEMS = [
  {
    q: "What is vibe coding?",
    a: "Vibe coding is the practice of building software using AI-powered IDEs and coding assistants like Claude Code, Cursor, Bolt, and Windsurf. Rather than following traditional development processes with lengthy planning cycles and sprints, vibe coders focus on staying in flow state, shipping features fast, and committing code every single day. The philosophy prioritizes working software in production over documentation, and consistency over sporadic bursts of activity. Vibe coders leverage AI to handle boilerplate and repetitive tasks, freeing them to focus on architecture decisions, product design, and rapid iteration. The result is developers who ship more, ship faster, and build a verifiable track record of daily output that speaks louder than any resume.",
  },
  {
    q: "How does the VibeTalent vibe score work?",
    a: "The vibe score is VibeTalent's core reputation metric — a single number representing how consistently and effectively a developer ships code. It is calculated from four weighted components: coding streak days (40% weight), which measures consecutive days of GitHub commits; project quality scores (30% weight), based on GitHub repo health including stars, forks, commit frequency, and deployment status; GitHub activity (20% weight), covering commits, pull requests, code reviews, and issue participation; and peer endorsements (10% weight), where endorsements from higher-scored developers carry more weight. The score updates daily and is always based on verifiable, public data. It cannot be gamed through fake reviews or purchased followers — only real, consistent shipping moves the needle.",
  },
  {
    q: "What are coding streaks and why do they matter?",
    a: "A coding streak tracks the number of consecutive days you have committed code to at least one GitHub repository. VibeTalent syncs with your GitHub profile daily, and any commit to any public repository counts toward your streak. If a full calendar day passes with no commits (based on UTC), the streak resets to zero. Streaks matter because they are the single most reliable signal of developer consistency. A long streak is nearly impossible to fake — you cannot buy a 200-day streak. For clients evaluating talent, streak length is a stronger predictor of delivery reliability than years of experience or interview performance. Developers who code every day demonstrate intrinsic motivation, discipline, and the kind of sustained effort that translates directly into project success.",
  },
  {
    q: "How do VibeTalent badges work?",
    a: "Badges are visual milestones earned through streak achievements that appear on your profile and in search results. There are four levels: Bronze at 30 consecutive days, Silver at 90 days, Gold at 180 days, and Diamond at 365 days — a full year of daily coding. Each badge level signals increasing dedication and reliability to potential clients browsing the platform. Badges are permanent once earned — even if your streak resets, the badge remains on your profile as proof of past achievement. However, your active streak is displayed separately so clients can see both your historical consistency and current momentum. The badge system creates clear, achievable milestones that motivate developers to maintain their streaks while giving clients an instant visual indicator of a developer's commitment level.",
  },
  {
    q: "How is VibeTalent different from Upwork or Toptal?",
    a: "Traditional freelancer platforms like Upwork and Toptal rely on resumes, client reviews, and interview processes to evaluate developers. These signals are easy to game — anyone can write a polished resume or get a friend to leave a five-star review. VibeTalent takes a fundamentally different approach by ranking developers on verifiable proof of work: coding streaks that track consecutive days of GitHub commits, shipped projects with live URLs you can visit, quality scores based on actual repository health, and peer endorsements from other verified developers. You cannot fake a 200-day coding streak or fabricate a deployed project with real GitHub activity. This means clients can trust that the rankings reflect genuine ability and consistency, not just good self-marketing.",
  },
  {
    q: "Is VibeTalent free to use?",
    a: "Yes, VibeTalent is free for developers. Creating a profile, connecting your GitHub account, building your streak, earning badges, adding projects, and getting discovered by clients costs nothing. Rankings are based entirely on merit — your vibe score, streak, and project quality determine your visibility. The one optional paid feature is Featured Projects: developers can pay with USDC (on Base network) to pin a project to the homepage carousel for extra visibility. This is purely optional and does not affect your vibe score, badge level, or search ranking. Simply sign up, start coding every day, add your best projects, and let your proof of work attract opportunities.",
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
                "@id": `${siteUrl}/#website`,
                name: "VibeTalent",
                url: siteUrl,
                description:
                  "The marketplace for vibe coders who ship consistently. Find developers based on streaks, shipped projects, and vibe scores.",
                publisher: { "@id": `${siteUrl}/#organization` },
                potentialAction: {
                  "@type": "SearchAction",
                  target: `${siteUrl}/explore?q={search_term_string}`,
                  "query-input": "required name=search_term_string",
                },
              },
              {
                "@type": "Organization",
                "@id": `${siteUrl}/#organization`,
                name: "VibeTalent",
                url: siteUrl,
                logo: {
                  "@type": "ImageObject",
                  url: `${siteUrl}/og-image-v2.jpg`,
                  width: 1200,
                  height: 630,
                },
                contactPoint: {
                  "@type": "ContactPoint",
                  email: "vibetalentwork@gmail.com",
                  contactType: "customer service",
                },
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
        <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-14 pb-10 text-center">
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 text-sm font-bold uppercase tracking-wide text-[var(--foreground)] mb-6"
            style={{
              backgroundColor: "var(--bg-surface)",
              border: "2px solid var(--border-hard)",
              boxShadow: "var(--shadow-brutal-sm)",
            }}
          >
            <span>The vibecoders marketplace</span>
          </div>

          <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight uppercase text-[var(--foreground)]">
            Find Vibe Coders Who
            <br />
            <span className="text-accent-brutal">
              Actually Ship.
            </span>
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-lg text-[var(--text-secondary)] font-medium">
            A marketplace built on consistency and proof of work. No resumes. No portfolios.
            Just streaks, shipped projects, and vibe scores.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <HeroCTA />
            <Link
              href="/explore"
              className="btn-brutal btn-brutal-secondary text-base"
            >
              Explore Talent
            </Link>
          </div>

          {/* Stats */}
          <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mx-auto stagger-children">
            {[
              { label: "Active Builders", value: String(totalBuilders), icon: Users },
              { label: "Projects Shipped", value: String(totalProjects), icon: Code2 },
              { label: "Avg. Streak", value: `${avgStreak} ${avgStreak === 1 ? "day" : "days"}`, icon: Flame },
              { label: "Top Vibers", value: String(topVibecoders.length), icon: Target },
            ].map((stat) => (
              <div
                key={stat.label}
                className="text-center p-3"
                style={{
                  backgroundColor: "var(--bg-surface)",
                  border: "2px solid var(--border-hard)",
                  boxShadow: "var(--shadow-brutal-sm)",
                }}
              >
                <stat.icon size={18} className="mx-auto text-[var(--accent)] mb-1.5" />
                <div className="text-xl font-extrabold text-[var(--foreground)] font-mono">{stat.value}</div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)] mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <LiveActivityFeed />

      <FeaturedCarousel />

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
          <div className="-mx-4 px-4 sm:mx-0 sm:px-0 flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:gap-6 sm:overflow-visible sm:pb-0 sm:snap-none stagger-children">
            {topVibecoders.map((user, i) => (
              <div key={user.id} className="min-w-[280px] flex-shrink-0 snap-start sm:min-w-0 sm:flex-shrink">
                <VibecoderCard user={user} rank={i + 1} />
              </div>
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
              href="/projects"
              className="flex items-center gap-1 text-sm font-bold uppercase text-[var(--accent)] hover:underline transition-colors"
            >
              See All <ArrowRight size={14} />
            </Link>
          </div>

          {featuredProjects.length > 0 ? (
            <div className="-mx-4 px-4 sm:mx-0 sm:px-0 flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:gap-6 sm:overflow-visible sm:pb-0 sm:snap-none stagger-children">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {featuredProjects.map((project: any) => (
                <div key={project.id} className="min-w-[280px] flex-shrink-0 snap-start sm:min-w-0 sm:flex-shrink">
                  <ProjectCard project={project} verified={!!project.verified} authorUsername={project.users?.username} />
                </div>
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
              <details
                key={faq.q}
                className="group p-5 cursor-pointer"
                style={{
                  backgroundColor: "var(--bg-surface)",
                  border: "2px solid var(--border-hard)",
                  boxShadow: "var(--shadow-brutal-sm)",
                }}
              >
                <summary className="text-base font-extrabold uppercase text-[var(--foreground)] list-none flex items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
                  {faq.q}
                  <span className="text-[var(--text-muted)] text-lg shrink-0 transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm text-[var(--text-secondary)] font-medium leading-relaxed">{faq.a}</p>
              </details>
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
