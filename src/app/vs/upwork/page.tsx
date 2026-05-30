import type { Metadata } from "next";
import { jsonLdHtml } from "@/lib/json-ld";
import Link from "next/link";
import { Check, X, ArrowRight, Flame, Zap, Shield } from "lucide-react";
import { siteUrl } from "@/lib/seo";

const PAGE_URL = `${siteUrl}/vs/upwork`;
const PAGE_TITLE = "VibeTalent vs Upwork — Which Is Better for Hiring Developers?";
const PAGE_DESCRIPTION =
  "VibeTalent ranks developers on verifiable proof of work — coding streaks, shipped projects, and GitHub activity. Upwork relies on resumes and client reviews. Side-by-side comparison, pricing, and which platform fits your hiring needs.";

const TL_DR =
  "VibeTalent ranks developers on verifiable proof of work — daily coding streaks, deployed projects, and GitHub activity — while Upwork relies on self-reported resumes and client reviews that are easy to game. Pick VibeTalent if you want to hire developers based on what they actually ship, especially AI-native builders using Claude Code, Cursor, or Bolt. Pick Upwork if you need a generalist freelance marketplace with escrow and a broad talent pool across non-engineering roles.";

const FAQ = [
  {
    q: "What is the main difference between VibeTalent and Upwork?",
    a: "Upwork is a generalist freelance marketplace where talent is ranked by self-reported skills, client reviews, and resume-style profiles — all of which can be gamed with paid reviews or polished marketing. VibeTalent is a developer-only marketplace where rankings come from verifiable data: GitHub commit streaks, deployed project quality, repo health, and peer endorsements weighted by the endorser's own vibe score. The data refreshes daily and cannot be faked.",
  },
  {
    q: "Is VibeTalent cheaper than Upwork?",
    a: "VibeTalent is free for both developers and clients. There is no platform fee on hires and no commission on payments. The only paid feature is optional Featured Projects placement, priced in USDC on Base or Solana with no platform markup. Upwork charges freelancers a 10% service fee and adds a payment processing fee on top of that, plus a 5% client marketplace fee on hires.",
  },
  {
    q: "Can I hire AI-native developers on Upwork?",
    a: "You can search for developers on Upwork who list AI tools in their skill tags, but there is no way to verify that they actually use those tools daily or ship working software with them. VibeTalent was built specifically for vibe coders — developers who use Claude Code, Cursor, Bolt, and Windsurf to ship code every day — and ranks them on the activity that proves they actually do it.",
  },
  {
    q: "Does Upwork show GitHub data?",
    a: "Upwork lets freelancers link their GitHub profile, but it does not pull commit history, repo quality, or streak data into rankings. The Upwork search algorithm weights job success score, hours billed, and client reviews. VibeTalent makes GitHub activity the core ranking signal — coding streak length is 40% of the vibe score by itself.",
  },
  {
    q: "How does VibeTalent prevent fake reviews?",
    a: "VibeTalent does not rely on reviews. Rankings come from public GitHub data — commit streaks, repo statistics, deployment status, and contribution patterns — none of which can be paid for or fabricated. Peer endorsements exist but are weighted at only 10% of the vibe score and weighted by the endorser's own score to make collusion economically unattractive.",
  },
  {
    q: "Is Upwork or VibeTalent better for a one-off project?",
    a: "Upwork is better for one-off non-engineering projects (design, copywriting, virtual assistance, video editing) or for hiring at large scale with escrow protection. VibeTalent is better for finding a developer who can ship a working product fast — whether that is a one-week prototype or an ongoing build relationship — because the platform surfaces builders proven to ship consistently.",
  },
];

const COMPARISON_ROWS: { feature: string; vt: string | boolean; up: string | boolean }[] = [
  { feature: "Talent type", vt: "AI-native developers", up: "Generalist freelancers" },
  { feature: "Ranking signal", vt: "GitHub streaks + shipped projects", up: "Resumes + client reviews" },
  { feature: "Verifiable proof of work", vt: true, up: false },
  { feature: "GitHub commit streak tracking", vt: true, up: false },
  { feature: "Project quality scoring from repo health", vt: true, up: false },
  { feature: "AI-powered hire matching", vt: "VibeFinder Bot", up: "Project catalog search" },
  { feature: "Platform fee for clients", vt: "0%", up: "5% marketplace fee" },
  { feature: "Service fee for developers", vt: "0%", up: "10% service fee" },
  { feature: "Crypto payments (USDC)", vt: true, up: false },
  { feature: "Escrow protection", vt: false, up: true },
  { feature: "Non-engineering roles", vt: false, up: true },
  { feature: "Public daily activity feed", vt: true, up: false },
];

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
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

export default function VsUpworkPage() {
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Compare", item: `${siteUrl}/vs` },
      { "@type": "ListItem", position: 3, name: "VibeTalent vs Upwork", item: PAGE_URL },
    ],
  };

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    dateModified: "2026-05-22",
    mainEntity: FAQ.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };

  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: PAGE_URL,
    mainEntityOfPage: { "@type": "WebPage", "@id": PAGE_URL },
    dateModified: "2026-05-22",
    author: { "@type": "Organization", "@id": `${siteUrl}/#organization`, name: "VibeTalent" },
    publisher: { "@type": "Organization", "@id": `${siteUrl}/#organization`, name: "VibeTalent" },
    about: [
      { "@type": "Organization", name: "VibeTalent", url: siteUrl },
      { "@type": "Organization", name: "Upwork", url: "https://www.upwork.com" },
    ],
  };

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(breadcrumbLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(articleLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(faqLd) }}
      />

      <div className="mb-10">
        <div
          className="inline-flex items-center gap-2 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-[var(--foreground)] mb-6"
          style={{
            backgroundColor: "var(--bg-surface)",
            border: "2px solid var(--border-hard)",
            boxShadow: "var(--shadow-brutal-sm)",
          }}
        >
          <Zap size={14} className="text-[var(--accent)]" />
          Comparison
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold uppercase text-[var(--foreground)] leading-tight">
          VibeTalent <span className="text-[var(--text-muted)]">vs</span>{" "}
          <span className="text-[var(--accent)]">Upwork</span>
        </h1>
        <p className="mt-3 text-[var(--text-secondary)] font-medium">
          Which platform is better for hiring developers in 2026? A side-by-side breakdown.
        </p>
      </div>

      {/* Answer block — the TL;DR sits at the top so AI engines pull it into
          answer boxes and humans can decide in 10 seconds. */}
      <section
        className="p-6 sm:p-8 mb-10"
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "2px solid var(--border-hard)",
          boxShadow: "var(--shadow-brutal)",
        }}
      >
        <h2 className="text-lg font-extrabold uppercase text-[var(--foreground)] mb-4">
          The short answer
        </h2>
        <p className="text-base text-[var(--foreground)] font-medium leading-relaxed">{TL_DR}</p>
      </section>

      {/* Feature matrix */}
      <section className="mb-12">
        <h2 className="text-2xl font-extrabold uppercase text-[var(--foreground)] mb-6">
          Side-by-side comparison
        </h2>
        <div
          className="overflow-hidden"
          style={{
            backgroundColor: "var(--bg-surface)",
            border: "2px solid var(--border-hard)",
            boxShadow: "var(--shadow-brutal)",
          }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border-hard)" }}>
                  <th className="text-left p-4 font-extrabold uppercase text-[var(--foreground)]">
                    Feature
                  </th>
                  <th className="text-left p-4 font-extrabold uppercase text-[var(--accent)]">
                    VibeTalent
                  </th>
                  <th className="text-left p-4 font-extrabold uppercase text-[var(--text-muted)]">
                    Upwork
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row, i) => (
                  <tr
                    key={row.feature}
                    style={{
                      borderBottom:
                        i === COMPARISON_ROWS.length - 1
                          ? "none"
                          : "1px solid var(--border-subtle)",
                    }}
                  >
                    <td className="p-4 font-semibold text-[var(--foreground)]">{row.feature}</td>
                    <td className="p-4 font-medium text-[var(--text-secondary)]">
                      {typeof row.vt === "boolean" ? (
                        row.vt ? (
                          <Check size={18} className="text-[var(--accent)]" />
                        ) : (
                          <X size={18} className="text-[var(--text-muted)]" />
                        )
                      ) : (
                        row.vt
                      )}
                    </td>
                    <td className="p-4 font-medium text-[var(--text-secondary)]">
                      {typeof row.up === "boolean" ? (
                        row.up ? (
                          <Check size={18} className="text-[var(--accent)]" />
                        ) : (
                          <X size={18} className="text-[var(--text-muted)]" />
                        )
                      ) : (
                        row.up
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="grid sm:grid-cols-2 gap-6 mb-12">
        <div
          className="p-6"
          style={{
            backgroundColor: "var(--bg-surface)",
            border: "2px solid var(--border-hard)",
            boxShadow: "var(--shadow-brutal)",
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Flame size={20} className="text-[var(--accent)]" />
            <h2 className="text-lg font-extrabold uppercase text-[var(--foreground)]">
              When VibeTalent wins
            </h2>
          </div>
          <ul className="space-y-2 text-sm text-[var(--text-secondary)] font-medium">
            <li>You want to hire AI-native developers using Claude Code, Cursor, or Bolt</li>
            <li>You care more about shipping evidence than years of experience</li>
            <li>You want to pay in USDC with no platform fees</li>
            <li>You need a builder who can prototype and ship in days, not months</li>
            <li>You are tired of fake five-star reviews and want verifiable signal</li>
          </ul>
        </div>

        <div
          className="p-6"
          style={{
            backgroundColor: "var(--bg-surface)",
            border: "2px solid var(--border-hard)",
            boxShadow: "var(--shadow-brutal)",
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Shield size={20} className="text-[var(--text-muted)]" />
            <h2 className="text-lg font-extrabold uppercase text-[var(--foreground)]">
              When Upwork wins
            </h2>
          </div>
          <ul className="space-y-2 text-sm text-[var(--text-secondary)] font-medium">
            <li>You need non-engineering roles (design, writing, video, admin)</li>
            <li>You want built-in escrow and dispute resolution</li>
            <li>You are hiring at large scale across multiple disciplines</li>
            <li>You need fiat invoicing and tax documents through the platform</li>
            <li>Your project is heavily resume-driven (regulated industries, agencies)</li>
          </ul>
        </div>
      </section>

      {/* FAQ */}
      <section className="mb-12">
        <h2 className="text-2xl font-extrabold uppercase text-[var(--foreground)] mb-6">
          Frequently asked questions
        </h2>
        <div className="space-y-3">
          {FAQ.map(({ q, a }) => (
            <details
              key={q}
              className="group p-5"
              style={{
                backgroundColor: "var(--bg-surface)",
                border: "2px solid var(--border-hard)",
                boxShadow: "var(--shadow-brutal-sm)",
              }}
            >
              <summary className="cursor-pointer font-extrabold uppercase text-sm text-[var(--foreground)] flex items-center justify-between">
                {q}
                <ArrowRight
                  size={14}
                  className="text-[var(--accent)] transition-transform group-open:rotate-90"
                />
              </summary>
              <p className="mt-3 text-sm text-[var(--text-secondary)] font-medium leading-relaxed">
                {a}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section
        className="p-8 sm:p-10 text-center"
        style={{
          backgroundColor: "var(--bg-inverted)",
          border: "2px solid var(--border-hard)",
          boxShadow: "8px 8px 0 var(--accent)",
        }}
      >
        <h2 className="text-2xl sm:text-3xl font-extrabold uppercase text-white mb-3">
          Hire builders who actually ship
        </h2>
        <p className="text-sm text-[var(--text-muted-soft)] font-medium mb-6 max-w-md mx-auto">
          Browse vibe coders ranked by streak, project quality, and verified GitHub activity.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/explore" className="btn-brutal btn-brutal-accent inline-flex items-center gap-2 justify-center">
            Explore talent <ArrowRight size={14} />
          </Link>
          <Link href="/agent" className="btn-brutal btn-brutal-secondary inline-flex items-center gap-2 justify-center">
            Try VibeFinder Bot
          </Link>
        </div>
      </section>
    </div>
  );
}
