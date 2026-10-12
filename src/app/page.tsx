import { LiveActivityFeed } from "@/components/ui/live-activity-feed";
import { jsonLdHtml } from "@/lib/json-ld";
import { NetworkFeed } from "@/components/feed/network-feed";
import { ForkHero } from "@/components/homepage/fork-hero";
import { ProofWallHero } from "@/components/homepage/proof-wall-hero";
import Link from "next/link";
import { VibecoderCard } from "@/components/ui/vibecoder-card";
import { ProjectCard } from "@/components/ui/project-card";
import { HeroCTA } from "@/components/ui/hero-cta";
import { TestimonialScroll } from "@/components/ui/testimonial-scroll";
import { fetchHomepageDataCached, fetchProofWallCached } from "@/lib/supabase/server-queries";
import {
  fetchHomepageFeedCached,
  SPARSE_THRESHOLD,
  type HomepageFeedItem,
} from "@/lib/homepage-feed";
import { siteUrl } from "@/lib/seo";
import { ArrowRight } from "lucide-react";
import { Fire, GitCommit, Trophy } from "@phosphor-icons/react/dist/ssr";

// Feature flag: gates the new homepage feed section. When false (or unset),
// the homepage renders the existing `<LiveActivityFeed />` snippet exactly
// like before. Strict equality with "true" — same convention as the
// onboarding tour flag. Kill switch in Vercel takes ~30s to flip back.
const HOMEPAGE_FEED_V2_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_HOMEPAGE_FEED_V2 === "true";

// 3 minutes rather than 1: every expiry schedules a background re-render that
// fans out to Supabase, and the live parts of this page (activity feed, network
// feed) poll on the client anyway — so a wider server window costs no freshness
// a visitor can perceive.
export const revalidate = 180;

const FAQ_ITEMS = [
  {
    q: "What is vibe coding?",
    a: "Vibe coding means building software with AI coding tools such as Claude Code, Cursor, Bolt, and Windsurf. Developers use these tools to turn ideas into software and iterate on it. When hiring, inspect the working product and repository, and ask the builder to explain their contribution; tool choice and commit frequency do not establish skill or delivery.",
  },
  {
    q: "Where can I hire vibe coders?",
    a: "Browse builders and projects on VibeTalent, or describe your project to VibeFinder Bot for matches based on skills and project evidence. The leaderboard uses Vibe Score; commits and streaks add no points. Inspect the work, then use the Hire button on a builder's profile to contact them directly.",
  },
  {
    q: "What is the best marketplace to hire vibe coders?",
    a: "Choose a marketplace that lets you inspect relevant work and speak with the developer. VibeTalent provides public projects, repository checks, community feedback, and matching by skills and project evidence. Use those signals to create a shortlist, then assess the builder through a conversation, references, or a clearly scoped paid trial.",
  },
  {
    q: "How does the VibeTalent vibe score work?",
    a: "Vibe Score combines your strongest verified public project's evidence with endorsements, trusted reviews, and vouches. Commits, streaks, badges, popularity, and extra copies of a project add no points. Repository checks describe file presence and control of the repository; they do not prove passing tests, original authorship, or delivery. Inspect the work and discuss your requirements directly.",
  },
  {
    q: "What are coding streaks and why do they matter?",
    a: "A streak tracks consecutive recorded activity days, including linked GitHub activity and manual check-ins. Streak freezes or restores can also preserve it. It adds no Vibe Score points and does not establish code quality or client delivery. Inspect the projects and speak with the builder.",
  },
  {
    q: "How do VibeTalent badges work?",
    a: "Badges mark recorded activity streak milestones: Bronze at 30 days, Silver at 90, Gold at 180, and Diamond at 365. Earned badges remain when the active streak resets. They add no Vibe Score points and do not establish code quality or reliability on a client project.",
  },
  {
    q: "How is VibeTalent different from Upwork or Toptal?",
    a: "VibeTalent lets you compare public GitHub activity, shipped projects with live URLs, repository signals, and peer endorsements before contacting a builder. These are useful starting points for evaluation, alongside interviews and references. Open the work yourself and ask what the builder contributed before making a hiring decision.",
  },
  {
    q: "Is VibeTalent free to use?",
    a: "Yes. Creating a profile, connecting GitHub, sharing projects, tracking activity, and contacting builders are free. Featured Projects is an optional paid promotion for extra project visibility; it does not increase Vibe Score. Leaderboard positions use Vibe Score, and streaks add no points.",
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
  let totalProjects = 0;
  let avgStreak = 0;
  let homepageFeed: HomepageFeedItem[] = [];

  // Run the existing homepage data fetch and the new feed fetch in parallel.
  // Promise.allSettled means a failure in either branch never blocks the
  // other from rendering — the page degrades gracefully to default values
  // (empty arrays, zeroed stats) on the failed side. This matters more for
  // the feed than the stats: a transient feed-query timeout shouldn't make
  // the homepage stats disappear, and vice versa.
  const [homepageDataResult, homepageFeedResult, proofWallResult] = await Promise.allSettled([
    fetchHomepageDataCached(),
    HOMEPAGE_FEED_V2_ENABLED
      ? fetchHomepageFeedCached()
      : Promise.resolve([] as HomepageFeedItem[]),
    fetchProofWallCached(),
  ]);
  // The wall degrades to null (hero renders headline + CTA without squares)
  // rather than blocking the page on a failed log scan.
  const proofWall = proofWallResult.status === "fulfilled" ? proofWallResult.value : null;

  if (homepageDataResult.status === "fulfilled") {
    const data = homepageDataResult.value;
    topVibecoders = data.topVibecoders;
    featuredProjects = data.featuredProjects;
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
    { icon: GitCommit, n: "01", title: "Share your work", desc: "Add a project with its repository and live demo. GitHub control and repository checks make the evidence available for inspection." },
    { icon: Fire, n: "02", title: "Build your Vibe Score", desc: "Your strongest verified project and community feedback contribute to reputation. Commits, streaks, and duplicate projects add no points." },
    { icon: Trophy, n: "03", title: "Get discovered", desc: "Founders find builders by skills and project evidence, inspect the work, and contact people whose projects fit their brief." },
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
                alternateName: "Vibe Talent",
                url: siteUrl,
                description:
                  "Find AI-assisted developers by skills, public project evidence, and community feedback.",
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
                alternateName: "Vibe Talent",
                url: siteUrl,
                description:
                  "VibeTalent is a marketplace for AI-assisted developers with public projects, repository checks, community feedback, and direct hiring.",
                logo: {
                  "@type": "ImageObject",
                  url: `${siteUrl}/logo.png`,
                  width: 669,
                  height: 669,
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

      {/* Hero — the proof wall (owner design), then the builder/hiring fork */}
      {proofWall ? (
        <ProofWallHero data={proofWall} totalProjects={totalProjects} avgStreak={avgStreak} />
      ) : (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 pt-12 sm:pt-16 pb-14">
          <h1 className="normal-case max-w-4xl text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.05] text-[var(--foreground)]">
            Hire AI-assisted developers who show their work.
          </h1>
          <p className="mt-5 max-w-2xl text-[var(--text-secondary)]">
            Compare shipped projects and GitHub-linked activity, then find a
            builder for your web app, MVP, or automation.
          </p>
        </section>
      )}
      <ForkHero />

      {/* How it works — merged from the old "What is Vibe Coding",
          "Why Streaks Matter", and end-game-ladder sections into one
          three-step story plus the streak-milestone badge ladder. */}
      <section
        style={{ borderTop: "1px solid var(--border-hard)", borderBottom: "1px solid var(--border-hard)", backgroundColor: "var(--bg-surface)" }}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-16">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-[var(--foreground)]">How it works</h2>
            <p className="mt-3 text-[var(--text-secondary)] font-medium max-w-2xl mx-auto">
              Share inspectable work, build your reputation, and connect with founders.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-3 stagger-children">
            {steps.map((s) => (
              <div key={s.n} className="card-brutal p-6">
                <div className="flex items-center justify-between">
                  <s.icon weight="fill" size={28} className="text-[var(--accent)]" />
                  <span className="font-mono text-2xl font-black text-[var(--border-subtle)]">{s.n}</span>
                </div>
                <h3 className="mt-4 text-lg font-bold text-[var(--foreground)]">{s.title}</h3>
                <p className="mt-2 text-sm text-[var(--text-secondary)] font-medium">{s.desc}</p>
              </div>
            ))}
          </div>

          {/* Badge ladder folded in as the visual for step 3 */}
          <div className="mt-10 max-w-3xl mx-auto">
            <p className="text-center text-[11px] font-semibold text-[var(--text-muted)] mb-4">
              Activity badges · no reputation points
            </p>
            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4">
              {badges.map((b) => (
                <div key={b.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-semibold text-[var(--foreground)]">{b.label}</span>
                    <span className="font-bold text-[var(--text-muted)]">{b.days} days</span>
                  </div>
                  <div className="h-3.5 rounded-full" style={{ backgroundColor: "var(--border-subtle)", border: "1px solid var(--border-subtle)" }}>
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
            <h2 className="text-3xl font-bold text-[var(--foreground)]">Who are the top vibe coders?</h2>
            <p className="mt-2 text-[var(--text-secondary)] font-medium">Ranked by project evidence and community feedback</p>
          </div>
          <Link
            href="/leaderboard"
            className="flex items-center gap-1 text-sm font-semibold text-[var(--accent)] hover:underline transition-colors"
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
            <p className="text-[var(--text-secondary)] font-semibold">No builders yet. Be the first to join!</p>
          </div>
        )}
      </section>

      {/* Recent projects — organic (paid featuring lives on /projects) */}
      <section
        style={{
          borderTop: "1px solid var(--border-hard)",
          backgroundColor: "var(--bg-surface)",
        }}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-20">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-[var(--foreground)]">What are vibe coders building?</h2>
              <p className="mt-2 text-[var(--text-secondary)] font-medium">Latest projects built by vibe coders, shipped fast</p>
            </div>
            <Link
              href="/projects"
              className="flex items-center gap-1 text-sm font-semibold text-[var(--accent)] hover:underline transition-colors"
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
              <p className="text-[var(--text-secondary)] font-semibold">No projects shipped yet. Start building!</p>
            </div>
          )}
        </div>
      </section>

      {/* Testimonials */}
      <section
        style={{
          borderTop: "1px solid var(--border-hard)",
          backgroundColor: "var(--bg-surface-light)",
        }}
      >
        <div className="py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 mb-8">
            <h2 className="text-3xl font-bold text-[var(--foreground)]">What do builders say about VibeTalent?</h2>
            <p className="mt-2 text-[var(--text-secondary)] font-medium">Real feedback from the community on X</p>
          </div>
          <TestimonialScroll />
        </div>
      </section>

      {/* FAQ */}
      <section
        style={{
          borderTop: "1px solid var(--border-subtle)",
        }}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-20">
          <h2 className="text-3xl font-bold text-[var(--foreground)] mb-8">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {FAQ_ITEMS.map((faq) => (
              <details
                key={faq.q}
                className="group p-5 cursor-pointer rounded-2xl"
                style={{
                  backgroundColor: "var(--bg-surface)",
                  border: "1px solid var(--border-subtle)",
                  boxShadow: "var(--shadow-brutal-sm)",
                }}
              >
                <summary className="text-base font-bold text-[var(--foreground)] list-none flex items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
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
          className="p-10 sm:p-12 text-center rounded-3xl"
          style={{
            backgroundColor: "var(--bg-inverted)",
            border: "1px solid var(--border-subtle)",
            boxShadow: "var(--shadow-brutal-accent)",
          }}
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-white">Join the Marketplace</h2>
          <p className="mt-4 text-[var(--text-muted-soft)] font-medium max-w-xl mx-auto">
            Start building your vibe coding reputation today. Create a profile,
            start your streak, and let your proof of work get you discovered.
          </p>
          <HeroCTA className="mt-8 inline-flex" />
        </div>
      </section>
    </div>
  );
}
