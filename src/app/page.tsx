import { LiveActivityFeed } from "@/components/ui/live-activity-feed";
import { jsonLdHtml } from "@/lib/json-ld";
import { NetworkFeed } from "@/components/feed/network-feed";
import { ForkHero } from "@/components/homepage/fork-hero";
import Link from "next/link";
import { VibecoderCard } from "@/components/ui/vibecoder-card";
import { ProjectCard } from "@/components/ui/project-card";
import { HeroCTA } from "@/components/ui/hero-cta";
import { TestimonialScroll } from "@/components/ui/testimonial-scroll";
import { fetchHomepageDataCached } from "@/lib/supabase/server-queries";
import {
  fetchHomepageFeedCached,
  SPARSE_THRESHOLD,
  type HomepageFeedItem,
} from "@/lib/homepage-feed";
import { siteUrl } from "@/lib/seo";
import { Flame, Trophy, GitCommitHorizontal, Zap, ArrowRight } from "lucide-react";

// Feature flag: gates the new homepage feed section. When false (or unset),
// the homepage renders the existing `<LiveActivityFeed />` snippet exactly
// like before. Strict equality with "true" — same convention as the
// onboarding tour flag. Kill switch in Vercel takes ~30s to flip back.
const HOMEPAGE_FEED_V2_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_HOMEPAGE_FEED_V2 === "true";

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

// The homepage's featuredProjects query joins users(username) onto each row
// (see _fetchHomepageData), so the bare Project type was lying about the
// shape and forced us to fall back to `any` at the map site. Capturing the
// join in one local type lets the render site stay un-annotated and lets us
// drop the `// eslint-disable-next-line @typescript-eslint/no-explicit-any`
// pragma below.
type HomepageFeaturedProject = import("@/lib/types/database").Project & {
  users?: { username: string | null } | null;
};

export default async function HomePage() {
  let topVibecoders: import("@/lib/types/database").UserWithSocials[] = [];
  let featuredProjects: HomepageFeaturedProject[] = [];
  let totalBuilders = 0;
  let totalProjects = 0;
  let avgStreak = 0;
  let homepageFeed: HomepageFeedItem[] = [];

  // Run the existing homepage data fetch and the new feed fetch in parallel.
  // Promise.allSettled means a failure in either branch never blocks the
  // other from rendering — the page degrades gracefully to default values
  // (empty arrays, zeroed stats) on the failed side. This matters more for
  // the feed than the stats: a transient feed-query timeout shouldn't make
  // the homepage stats disappear, and vice versa.
  const [homepageDataResult, homepageFeedResult] = await Promise.allSettled([
    fetchHomepageDataCached(),
    HOMEPAGE_FEED_V2_ENABLED
      ? fetchHomepageFeedCached()
      : Promise.resolve([] as HomepageFeedItem[]),
  ]);

  if (homepageDataResult.status === "fulfilled") {
    const data = homepageDataResult.value;
    topVibecoders = data.topVibecoders;
    featuredProjects = data.featuredProjects;
    totalBuilders = data.totalBuilders;
    totalProjects = data.totalProjects;
    avgStreak = data.avgStreak;
  } else {
    console.error("[HomePage] Failed to fetch homepage data:", homepageDataResult.reason);
  }

  if (homepageFeedResult.status === "fulfilled") {
    homepageFeed = homepageFeedResult.value;
  } else {
    // Feed-fetch failure is not fatal — we just fall back to the snippet.
    console.error("[HomePage] Failed to fetch homepage feed:", homepageFeedResult.reason);
  }

  // Render the new section only when the flag is on AND we have enough
  // items for it to look alive. Below SPARSE_THRESHOLD, fall back to the
  // existing snippet — better a tight curated card than a half-empty grid.
  const showFeedV2 =
    HOMEPAGE_FEED_V2_ENABLED && homepageFeed.length >= SPARSE_THRESHOLD;

  // "How it works" — three steps that merge the old "What is Vibe Coding",
  // "Why Streaks Matter", and end-game-ladder sections into one story.
  const steps = [
    { icon: GitCommitHorizontal, n: "01", title: "Ship daily", desc: "Commit every day. VibeTalent verifies your GitHub and builds your streak automatically." },
    { icon: Flame, n: "02", title: "Build your Vibe Score", desc: "Streaks, project quality, and endorsements roll into one reputation number that can't be faked." },
    { icon: Trophy, n: "03", title: "Get discovered & earn badges", desc: "Climb the leaderboard, unlock Bronze → Diamond badges, and let clients find you by proof of work." },
  ];

  const badges = [
    { label: "Bronze", days: 30, color: "#D97706", width: "8%" },
    { label: "Silver", days: 90, color: "var(--text-muted)", width: "25%" },
    { label: "Gold", days: 180, color: "#CA8A04", width: "50%" },
    { label: "Diamond", days: 365, color: "#0891B2", width: "100%" },
  ];

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdHtml({
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
                  "https://x.com/vibetalentwork",
                  "https://x.com/abhiontwt",
                  "https://t.me/vibetalentwork",
                  "https://github.com/unknownking07/vibe-talent",
                ],
              },
            ],
          }),
        }}
      />

      {/* Hero — explicit builder/hiring fork + shared proof strip */}
      <ForkHero
        stats={{
          totalBuilders,
          totalProjects,
          avgStreak,
          topVibers: topVibecoders.length,
        }}
      />

      {/* How it works — merged from the old "What is Vibe Coding",
          "Why Streaks Matter", and end-game-ladder sections into one
          three-step story plus the streak-milestone badge ladder. */}
      <section
        style={{ borderTop: "2px solid var(--border-hard)", borderBottom: "2px solid var(--border-hard)", backgroundColor: "var(--bg-surface)" }}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-16">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-extrabold uppercase text-[var(--foreground)]">How it works</h2>
            <p className="mt-3 text-[var(--text-secondary)] font-medium max-w-2xl mx-auto">
              Three steps. No resumes, no portfolios — just proof you show up and ship.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-3 stagger-children">
            {steps.map((s) => (
              <div key={s.n} className="card-brutal p-6">
                <div className="flex items-center justify-between">
                  <s.icon size={28} className="text-[var(--accent)]" />
                  <span className="font-mono text-2xl font-black text-[var(--border-subtle)]">{s.n}</span>
                </div>
                <h3 className="mt-4 text-lg font-extrabold uppercase text-[var(--foreground)]">{s.title}</h3>
                <p className="mt-2 text-sm text-[var(--text-secondary)] font-medium">{s.desc}</p>
              </div>
            ))}
          </div>

          {/* Badge ladder folded in as the visual for step 3 */}
          <div className="mt-10 max-w-3xl mx-auto">
            <p className="text-center text-[11px] font-extrabold uppercase tracking-widest text-[var(--text-muted)] mb-4">
              Streak milestones
            </p>
            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4">
              {badges.map((b) => (
                <div key={b.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-bold uppercase text-[var(--foreground)]">{b.label}</span>
                    <span className="font-bold text-[var(--text-muted)]">{b.days} days</span>
                  </div>
                  <div className="h-3.5" style={{ backgroundColor: "var(--border-subtle)", border: "2px solid var(--border-hard)" }}>
                    <div className="h-full" style={{ backgroundColor: b.color, width: b.width }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Live Network Feed — the homepage's "what's happening right now" surface.
          When HOMEPAGE_FEED_V2_ENABLED is on AND the feed has enough items
          to look alive (>= SPARSE_THRESHOLD), mount the compact NetworkFeed
          (same component the /feed page uses, just with one column + chip
          filters). Otherwise fall back to the existing snippet. */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 pt-6 pb-2">
        {showFeedV2 ? (
          <NetworkFeed variant="compact" initialItems={homepageFeed} />
        ) : (
          <LiveActivityFeed />
        )}
      </section>

      {/* Top Vibecoders */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-20">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-extrabold uppercase text-[var(--foreground)]">Who are the top vibe coders?</h2>
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
          // Vertical stack on mobile (no more horizontal swipe carousel — was
          // confusing on small screens because the second card was clipped
          // off-screen and discoverability suffered), 2-up on sm, 3-up on lg.
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 stagger-children">
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
              <h2 className="text-3xl font-extrabold uppercase text-[var(--foreground)]">What are vibe coders building?</h2>
              <p className="mt-2 text-[var(--text-secondary)] font-medium">Featured projects built by vibe coders, shipped fast</p>
            </div>
            <Link
              href="/projects"
              className="flex items-center gap-1 text-sm font-bold uppercase text-[var(--accent)] hover:underline transition-colors"
            >
              See All <ArrowRight size={14} />
            </Link>
          </div>

          {featuredProjects.length > 0 ? (
            // Same shape as Top Talent above — vertical stack on mobile,
            // grid on sm+. Keep stagger-children so the entrance animation
            // still cascades down the column.
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 stagger-children">
              {featuredProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  verified={!!project.verified}
                  authorUsername={project.users?.username ?? undefined}
                />
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
            <h2 className="text-3xl font-extrabold uppercase text-[var(--foreground)]">What do builders say about VibeTalent?</h2>
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
            __html: jsonLdHtml({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              dateModified: "2026-05-22",
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
            start your streak, and let your proof of work get you discovered.
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
