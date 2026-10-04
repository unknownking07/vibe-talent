import type { Metadata } from "next";
import { jsonLdHtml } from "@/lib/json-ld";
import Link from "next/link";
import { X, ArrowRight } from "lucide-react";
import { Check, Fire, Lightning, Shield } from "@phosphor-icons/react/dist/ssr";
import { defaultSocialImage, siteUrl } from "@/lib/seo";

const PAGE_URL = `${siteUrl}/vs/upwork`;
const PAGE_TITLE = "VibeTalent vs Upwork: Which Is Better for Hiring Developers?";
const PAGE_DESCRIPTION =
  "Compare VibeTalent and Upwork for hiring developers: public GitHub activity and shipped projects, marketplace fees, matching tools, and payment protection.";
const DATE_MODIFIED = "2026-10-04";

const TL_DR =
  "VibeTalent focuses on AI-assisted developers, with public GitHub activity, shipped projects, client reviews, and peer endorsements you can inspect before contacting a builder. Upwork covers a broader range of freelance work and provides contracts, payment protection, and matching tools. Choose VibeTalent to build a shortlist from public work and agree terms directly. Choose Upwork when you want to manage the contract and payments inside a marketplace. On either platform, review relevant samples and agree on scope before hiring.";

const FAQ = [
  {
    q: "What is the main difference between VibeTalent and Upwork?",
    a: "Upwork is a general freelance marketplace with broad talent coverage. VibeTalent focuses on developers and shows GitHub-linked activity, shipped projects, repository signals, and peer endorsements. Those public signals help you inspect work, but they are not a guarantee of quality or delivery.",
  },
  {
    q: "Is VibeTalent cheaper than Upwork?",
    a: "VibeTalent charges no platform commission on direct hires; clients and builders agree their own rates and payment terms. Optional project promotion is paid separately. Upwork's freelancer service fee ranges from 0% to 15% per contract. Clients on its Basic plan pay a Marketplace Fee of up to 7.99%, with a 3% rate for eligible U.S. bank-account payments, plus a one-time contract initiation fee of $0.99 to $14.99. Fees and exceptions can change; check Upwork's official fee pages before hiring.",
  },
  {
    q: "Can I hire AI-native developers on Upwork?",
    a: "Yes. You can look for developers with relevant AI-tool experience on either platform. VibeTalent focuses on AI-assisted builders and makes their projects and GitHub-linked activity visible. GitHub activity does not prove which AI tool someone used. Ask for relevant demos, repository access where appropriate, and an explanation of how the developer tests and reviews generated code.",
  },
  {
    q: "What GitHub evidence can I review on VibeTalent?",
    a: "VibeTalent profiles can show GitHub-verified activity streaks, linked repositories, shipped projects, and automated repository quality signals. The vibe score combines activity, projects, badges, client reviews, and endorsements; streaks do not have a fixed percentage weight. Inspect the underlying work as well as the score. Commit counts and repository signals do not establish code quality or authorship on their own.",
  },
  {
    q: "Does VibeTalent use reviews in its rankings?",
    a: "Yes. Client reviews and peer endorsements contribute points to the vibe score. Profiles provide project and GitHub evidence alongside that feedback so clients can check more than ratings. These signals are not fraud-proof or a delivery guarantee; verify relevant work and use clear milestones before committing to a hire.",
  },
  {
    q: "Is Upwork or VibeTalent better for a one-off project?",
    a: "VibeTalent can help you find AI-assisted developers for a prototype or ongoing build through public profiles and direct contact. Upwork may fit better if you need non-engineering roles or marketplace-managed contracts and payment protection. Choose based on the developer's relevant work, the project scope, and the payment arrangements you need.",
  },
];

const COMPARISON_ROWS: { feature: string; vt: string | boolean; up: string | boolean }[] = [
  { feature: "Talent type", vt: "AI-native developers", up: "Generalist freelancers" },
  { feature: "Profile evidence", vt: "GitHub activity, projects, reviews + endorsements", up: "Skills, portfolios, work history + client feedback" },
  { feature: "Work samples to review", vt: "Projects + linked repositories", up: "Portfolio samples" },
  { feature: "GitHub commit streak tracking", vt: true, up: false },
  { feature: "Project quality scoring from repo health", vt: true, up: false },
  { feature: "Matching tools", vt: "VibeFinder Bot", up: "Talent search, Project Catalog + Uma (availability varies)" },
  { feature: "Platform commission for clients", vt: "0% on direct hires", up: "Basic: up to 7.99% + contract initiation fee" },
  { feature: "Service fee for developers", vt: "0% on direct hires", up: "0–15% per contract" },
  { feature: "Hiring payments", vt: "Agreed directly with the builder", up: "Managed through Upwork" },
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
    images: [{ url: defaultSocialImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    images: [defaultSocialImage],
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
    dateModified: DATE_MODIFIED,
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
    dateModified: DATE_MODIFIED,
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
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold text-[var(--foreground)] mb-6"
          style={{
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            boxShadow: "var(--shadow-brutal-xs)",
          }}
        >
          <Lightning weight="fill" size={14} className="text-[var(--accent)]" />
          Comparison
        </div>
        <h1 className="text-3xl sm:text-5xl font-bold text-[var(--foreground)] leading-tight">
          VibeTalent <span className="text-[var(--text-muted)]">vs</span>{" "}
          <span className="text-[var(--accent)]">Upwork</span>
        </h1>
        <p className="mt-3 text-[var(--text-secondary)] font-medium">
          Which platform is better for hiring developers in 2026? A side-by-side breakdown.
        </p>
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          Updated October 4, 2026. Fees vary by contract and plan.
        </p>
      </div>

      {/* Answer block — the TL;DR sits at the top so AI engines pull it into
          answer boxes and humans can decide in 10 seconds. */}
      <section
        className="p-6 sm:p-8 mb-10 rounded-2xl"
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          boxShadow: "var(--shadow-brutal)",
        }}
      >
        <h2 className="text-lg font-bold text-[var(--foreground)] mb-4">
          The short answer
        </h2>
        <p className="text-base text-[var(--foreground)] font-medium leading-relaxed">{TL_DR}</p>
      </section>

      {/* Feature matrix */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-[var(--foreground)] mb-6">
          Side-by-side comparison
        </h2>
        <div
          className="overflow-hidden rounded-2xl"
          style={{
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            boxShadow: "var(--shadow-brutal)",
          }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <th className="text-left p-4 font-bold text-[var(--foreground)]">
                    Feature
                  </th>
                  <th className="text-left p-4 font-bold text-[var(--accent)]">
                    VibeTalent
                  </th>
                  <th className="text-left p-4 font-bold text-[var(--text-muted)]">
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
                          <Check weight="bold" size={18} className="text-[var(--accent)]" />
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
                          <Check weight="bold" size={18} className="text-[var(--accent)]" />
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

      <p className="mb-12 text-sm text-[var(--text-secondary)] leading-relaxed">
        Upwork sources: {" "}
        <a className="underline" href="https://support.upwork.com/hc/en-us/articles/211062538-Learn-about-the-Freelancer-Service-Fee">freelancer fees</a>, {" "}
        <a className="underline" href="https://support.upwork.com/hc/en-us/articles/4660220468499-What-is-the-Client-Marketplace-Fee">client fees</a>, {" "}
        <a className="underline" href="https://support.upwork.com/hc/en-us/articles/26106318334611-What-is-the-Contract-Initiation-Fee-on-Upwork">contract initiation fees</a>, and {" "}
        <a className="underline" href="https://support.upwork.com/hc/en-us/articles/45809718947859-How-to-use-Uma-Upwork-s-Mindful-AI-to-search-for-freelancers">Uma search availability</a>.
        {" "}See <Link href="/pricing" className="underline">VibeTalent pricing</Link> and {" "}
        <Link href="/hire-ai-assisted-developers" className="underline">how hiring works</Link>.
      </p>

      <section className="grid sm:grid-cols-2 gap-6 mb-12">
        <div
          className="p-6 rounded-2xl"
          style={{
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            boxShadow: "var(--shadow-brutal)",
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Fire weight="fill" size={20} className="text-[var(--accent)]" />
            <h2 className="text-lg font-bold text-[var(--foreground)]">
              When VibeTalent wins
            </h2>
          </div>
          <ul className="space-y-2 text-sm text-[var(--text-secondary)] font-medium">
            <li>You want to hire AI-native developers using Claude Code, Cursor, or Bolt</li>
            <li>You care more about shipping evidence than years of experience</li>
            <li>You want to agree rates and payment terms directly with a builder</li>
            <li>You are shortlisting developers for a prototype or ongoing product</li>
            <li>You want project evidence alongside client reviews</li>
          </ul>
        </div>

        <div
          className="p-6 rounded-2xl"
          style={{
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            boxShadow: "var(--shadow-brutal)",
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Shield weight="fill" size={20} className="text-[var(--text-muted)]" />
            <h2 className="text-lg font-bold text-[var(--foreground)]">
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
        <h2 className="text-2xl font-bold text-[var(--foreground)] mb-6">
          Frequently asked questions
        </h2>
        <div className="space-y-3">
          {FAQ.map(({ q, a }) => (
            <details
              key={q}
              className="group p-5 rounded-2xl"
              style={{
                backgroundColor: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
                boxShadow: "var(--shadow-brutal-sm)",
              }}
            >
              <summary className="cursor-pointer font-bold text-sm text-[var(--foreground)] flex items-center justify-between">
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
        className="p-8 sm:p-10 text-center rounded-2xl"
        style={{
          backgroundColor: "var(--bg-inverted)",
          border: "1px solid var(--border-subtle)",
          boxShadow: "var(--shadow-brutal-accent)",
        }}
      >
        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
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
