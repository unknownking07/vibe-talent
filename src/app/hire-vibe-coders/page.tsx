import type { Metadata } from "next";
import Link from "next/link";
import { jsonLdHtml } from "@/lib/json-ld";
import { siteUrl } from "@/lib/seo";
import { CheckCircle, Lightning, Warning } from "@phosphor-icons/react/dist/ssr";

const PAGE_URL = `${siteUrl}/hire-vibe-coders`;
const PAGE_TITLE = "How to Hire Vibe Coders: A Practical 2026 Guide";
const PAGE_DESCRIPTION =
  "How to hire vibe coders and AI-native builders: the signals that predict delivery, the ones that do not, a five-step process, and where to find them.";

// Answer-first summary. Sits at the top of the page and is reused verbatim in
// the Article description so answer engines quoting the page get the same text
// a human reads.
const TL_DR =
  "Hire vibe coders on evidence of shipping, not on resumes. The strongest predictors are a live commit streak, deployed projects you can open in a browser, and repository quality you can inspect yourself. All three are public and none can be bought, unlike reviews and self-reported skill lists. Shortlist on those signals, then run one small paid trial task before committing to anything larger.";

const SIGNALS = [
  {
    title: "A live commit streak",
    body: "Consecutive days of public commits. It is the hardest signal to fake, because it cannot be bought or backdated, and it measures the thing you actually care about: whether this person ships when nobody is watching.",
  },
  {
    title: "Deployed projects with live URLs",
    body: "Not screenshots, not a portfolio PDF. A URL you can open right now. A builder who ships to production repeatedly has already solved the unglamorous parts: hosting, environment config, auth, and the last 10 percent that kills most side projects.",
  },
  {
    title: "Repository quality you can read",
    body: "Open the repo. Look at commit messages, how often they push, whether tests exist, whether the README lets you run it. Ten minutes of reading a repo tells you more than an hour-long interview.",
  },
  {
    title: "Breadth across the stack",
    body: "AI-native builders tend to be unusually full-stack, because the tooling collapses the cost of working outside their specialty. Someone who has shipped frontend, backend, and deploys is often a better bet than a narrow specialist for early product work.",
  },
  {
    title: "Endorsements from other builders",
    body: "Peer signal from people who have shipped themselves is worth more than a client star rating, which mostly measures responsiveness and politeness rather than engineering judgment.",
  },
];

const STEPS = [
  {
    n: "1",
    title: "Write the task, not the role",
    body: "Skip the job description. Describe one concrete outcome: the thing you want working at the end. AI-native builders self-select accurately against a clear deliverable and poorly against a list of required technologies.",
  },
  {
    n: "2",
    title: "Shortlist on shipping evidence",
    body: "Filter on streak length, shipped projects, and repo quality before you read a single bio. Aim for a shortlist of three to five, not twenty.",
  },
  {
    n: "3",
    title: "Open their work yourself",
    body: "Visit two live projects and skim one repo per candidate. Budget ten minutes each. This step eliminates more bad fits than any interview round, and it costs you half an hour total.",
  },
  {
    n: "4",
    title: "Run one small paid trial",
    body: "A single scoped, paid task is the highest-signal interview that exists. You learn how they communicate, how they handle ambiguity, and how fast they actually move. Pay for it, always.",
  },
  {
    n: "5",
    title: "Hire directly and keep the loop short",
    body: "Once the trial lands, commit to a real scope of work. Keep feedback cycles short. The advantage of AI-native builders is iteration speed, and long review cycles waste exactly the thing you hired them for.",
  },
];

const RED_FLAGS = [
  "A portfolio full of screenshots but no URLs you can open.",
  "A long list of technologies with no public code behind any of them.",
  "Commit history that shows one enormous push and then silence for months.",
  "Reluctance to do a small paid trial task.",
  "Repositories that were all created in the same week, just before applying.",
];

const FAQ = [
  {
    q: "How do you hire vibe coders?",
    a: "Shortlist on public shipping evidence rather than resumes: a live commit streak, deployed projects with working URLs, and readable repository quality. Open two of their projects and skim one repo yourself, which takes about ten minutes per candidate. Then run one small paid trial task before agreeing to a larger scope. On VibeTalent you can filter builders by streak, shipped projects, and vibe score, then message them directly with no platform fee.",
  },
  {
    q: "What is a vibe coder?",
    a: "A vibe coder is a developer who builds primarily with AI-powered coding tools such as Claude Code, Cursor, or Windsurf, optimising for shipping speed and daily output rather than traditional planning cycles. The terms vibe coder and AI-native builder are used interchangeably. What distinguishes them in practice is throughput: they tend to ship more surface area per week and work across the whole stack.",
  },
  {
    q: "Where can I hire AI-native builders?",
    a: "VibeTalent is a developer-only marketplace where builders are ranked on verifiable proof of work rather than self-reported skills. General freelance platforms such as Upwork, Fiverr, and Freelancer have far larger talent pools but rank on reviews and resumes, which are easier to game. Toptal screens privately for senior freelancers at premium, account-managed rates. Which fits depends on whether you want the largest pool, the most vetting, or the clearest evidence of shipping.",
  },
  {
    q: "Are vibe coders as reliable as traditional developers?",
    a: "Reliability is a property of the individual, not the tooling. What changes with AI-native builders is that the evidence is unusually public: daily commit history and deployed projects are visible before you talk to anyone. That makes reliability easier to verify up front than it is with a conventional resume-and-interview process, where you usually find out after you have already committed.",
  },
  {
    q: "What should a trial task look like?",
    a: "Small, real, and paid. Pick something from your actual backlog that can be finished in a few hours, has a clear definition of done, and touches the parts of your stack the eventual work will touch. Avoid contrived puzzles and avoid unpaid work. The point is to observe communication, judgment under ambiguity, and delivery speed on a real problem.",
  },
];

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  keywords: [
    "how to hire vibe coders",
    "hire vibe coders",
    "hire AI-native builders",
    "hire AI native developers",
    "vibe coder hiring guide",
    "where to hire vibe coders",
  ],
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: PAGE_URL,
    siteName: "VibeTalent",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
  },
};

export default function HireVibeCodersPage() {
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "How to Hire Vibe Coders", item: PAGE_URL },
    ],
  };

  // No HowTo schema here: Google deprecated HowTo rich results in 2023, and the
  // steps below are advisory rather than a device-agnostic procedure.
  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: PAGE_TITLE,
    description: TL_DR,
    mainEntityOfPage: { "@type": "WebPage", "@id": PAGE_URL },
    author: { "@type": "Organization", "@id": `${siteUrl}/#organization`, name: "VibeTalent" },
    publisher: { "@type": "Organization", "@id": `${siteUrl}/#organization`, name: "VibeTalent" },
    about: [
      { "@type": "Thing", name: "Hiring developers" },
      { "@type": "Thing", name: "Vibe coding" },
      { "@type": "Thing", name: "AI-native software development" },
    ],
  };

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(breadcrumbLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(articleLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(faqLd) }} />

      <div className="mb-10">
        <div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold text-[var(--foreground)] mb-6"
          style={{
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            boxShadow: "var(--shadow-brutal-xs)",
          }}
        >
          <Lightning weight="fill" size={14} className="text-[var(--accent)]" />
          Hiring guide
        </div>
        <h1 className="text-3xl sm:text-5xl font-bold text-[var(--foreground)] leading-tight">
          How to hire <span className="text-[var(--accent)]">vibe coders</span>
        </h1>
        <p className="mt-3 text-[var(--text-secondary)] font-medium">
          A practical guide to hiring AI-native builders on evidence instead of resumes.
        </p>
      </div>

      {/* Answer-first block, so AI engines and skimmers both get the payload immediately. */}
      <section
        className="p-6 sm:p-8 mb-12 rounded-2xl"
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          boxShadow: "var(--shadow-brutal)",
        }}
      >
        <h2 className="text-lg font-bold text-[var(--foreground)] mb-4">The short answer</h2>
        <p className="text-base text-[var(--foreground)] font-medium leading-relaxed">{TL_DR}</p>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-[var(--foreground)] mb-4">
          What is a vibe coder?
        </h2>
        <div className="space-y-4 text-sm text-[var(--text-secondary)] font-medium leading-relaxed">
          <p>
            A vibe coder is a developer who builds primarily with AI-powered coding tools such as
            Claude Code, Cursor, or Windsurf. The label AI-native builder means the same thing and
            the two are used interchangeably. What actually separates them from a conventional hire
            is throughput: they ship more surface area per week, and they tend to work across the
            whole stack because the tooling makes stepping outside a specialty cheap.
          </p>
          <p>
            That changes what you should evaluate. Years of experience and framework checklists
            describe how someone trained. For AI-native work, what predicts delivery is how often
            they ship and what they have actually put in front of users. Both are public, which
            means you can check them before you ever send a message. For definitions of the
            individual terms, see the{" "}
            <Link href="/glossary/vibe-coder" className="text-[var(--accent)] font-semibold hover:underline">
              vibe coder
            </Link>{" "}
            and{" "}
            <Link href="/glossary/vibe-coding" className="text-[var(--accent)] font-semibold hover:underline">
              vibe coding
            </Link>{" "}
            glossary entries.
          </p>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-[var(--foreground)] mb-6">
          Five signals that predict delivery
        </h2>
        <div className="space-y-3">
          {SIGNALS.map((s) => (
            <div
              key={s.title}
              className="p-5 rounded-2xl"
              style={{
                backgroundColor: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
                boxShadow: "var(--shadow-brutal-sm)",
              }}
            >
              <div className="flex items-start gap-3">
                <CheckCircle weight="fill" size={18} className="text-[var(--accent)] shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-base font-bold text-[var(--foreground)] mb-1">{s.title}</h3>
                  <p className="text-sm text-[var(--text-secondary)] font-medium leading-relaxed">{s.body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-[var(--foreground)] mb-4">
          Why resumes fail here
        </h2>
        <div className="space-y-4 text-sm text-[var(--text-secondary)] font-medium leading-relaxed">
          <p>
            The signals most hiring processes lean on are the ones easiest to manufacture. A resume
            is self-reported. Client star ratings mostly measure responsiveness, and on marketplaces
            with paid review schemes they can be purchased outright. Interview performance measures
            interview performance.
          </p>
          <p>
            Shipping evidence resists all of that. You cannot buy a 200-day commit streak, and you
            cannot fake a deployed application that a stranger can open and use. That is the entire
            premise behind how{" "}
            <Link href="/explore" className="text-[var(--accent)] font-semibold hover:underline">
              builders are ranked on VibeTalent
            </Link>
            .
          </p>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-[var(--foreground)] mb-6">
          A five-step hiring process
        </h2>
        <div className="space-y-3">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="p-5 rounded-2xl flex items-start gap-4"
              style={{
                backgroundColor: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
                boxShadow: "var(--shadow-brutal-sm)",
              }}
            >
              <span
                className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold font-mono text-white"
                style={{ backgroundColor: "var(--accent)" }}
              >
                {s.n}
              </span>
              <div>
                <h3 className="text-base font-bold text-[var(--foreground)] mb-1">{s.title}</h3>
                <p className="text-sm text-[var(--text-secondary)] font-medium leading-relaxed">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-[var(--foreground)] mb-6">Red flags</h2>
        <div
          className="p-6 rounded-2xl"
          style={{
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            boxShadow: "var(--shadow-brutal-sm)",
          }}
        >
          <ul className="space-y-3">
            {RED_FLAGS.map((f) => (
              <li key={f} className="flex items-start gap-3 text-sm text-[var(--text-secondary)] font-medium leading-relaxed">
                <Warning weight="fill" size={16} className="text-[var(--accent)] shrink-0 mt-0.5" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-[var(--foreground)] mb-4">
          Where to hire vibe coders
        </h2>
        <div className="space-y-4 text-sm text-[var(--text-secondary)] font-medium leading-relaxed">
          <p>
            VibeTalent is built specifically for this: every builder is ranked on GitHub-verified
            streaks, shipped projects, and repository quality, and you can message them directly
            with no platform fee. Browse the{" "}
            <Link href="/explore" className="text-[var(--accent)] font-semibold hover:underline">
              talent directory
            </Link>{" "}
            or the{" "}
            <Link href="/leaderboard" className="text-[var(--accent)] font-semibold hover:underline">
              leaderboard
            </Link>{" "}
            to start.
          </p>
          <p>
            It is not the only option, and the honest trade-off is pool size. General marketplaces
            carry far more people but rank them on signals that are easier to game. If you want the
            detail, we have written it up:{" "}
            <Link href="/vs/upwork" className="text-[var(--accent)] font-semibold hover:underline">
              versus Upwork
            </Link>
            ,{" "}
            <Link href="/vs/fiverr" className="text-[var(--accent)] font-semibold hover:underline">
              Fiverr
            </Link>
            ,{" "}
            <Link href="/vs/toptal" className="text-[var(--accent)] font-semibold hover:underline">
              Toptal
            </Link>
            , and{" "}
            <Link href="/vs/freelancer" className="text-[var(--accent)] font-semibold hover:underline">
              Freelancer
            </Link>
            .
          </p>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-[var(--foreground)] mb-6">
          Frequently asked questions
        </h2>
        <div className="space-y-4">
          {FAQ.map(({ q, a }) => (
            <details
              key={q}
              className="group p-5 cursor-pointer rounded-2xl"
              style={{
                backgroundColor: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
                boxShadow: "var(--shadow-brutal-sm)",
              }}
            >
              <summary className="text-base font-bold text-[var(--foreground)] list-none flex items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
                {q}
                <span className="text-[var(--text-muted)] text-lg shrink-0 transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm text-[var(--text-secondary)] font-medium leading-relaxed">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <section
        className="p-10 text-center rounded-3xl"
        style={{
          backgroundColor: "var(--bg-inverted)",
          border: "1px solid var(--border-subtle)",
          boxShadow: "var(--shadow-brutal-accent)",
        }}
      >
        <h2 className="text-2xl sm:text-3xl font-bold text-white">Start with the evidence</h2>
        <p className="mt-3 text-[var(--text-muted-soft)] font-medium max-w-lg mx-auto">
          Browse builders ranked by commit streak, shipped projects, and repository quality. Hiring
          is direct and free.
        </p>
        <Link
          href="/explore"
          className="mt-7 inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-transform active:scale-[0.98]"
          style={{ backgroundColor: "var(--accent)" }}
        >
          Explore builders
        </Link>
      </section>
    </div>
  );
}
