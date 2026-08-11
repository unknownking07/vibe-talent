import type { Metadata } from "next";
import { jsonLdHtml } from "@/lib/json-ld";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Lightning } from "@phosphor-icons/react/dist/ssr";
import { siteUrl } from "@/lib/seo";
import { COMPARISONS } from "@/lib/comparisons";

const PAGE_URL = `${siteUrl}/vs`;
const PAGE_TITLE = "VibeTalent vs the Alternatives: Compare Hiring Platforms";
const PAGE_DESCRIPTION =
  "How VibeTalent compares to Upwork, Fiverr, Toptal, and Freelancer for hiring developers. VibeTalent ranks vibe coders on verifiable proof of work (coding streaks, shipped projects, and GitHub activity) instead of resumes and reviews.";

// Upwork predates the data-driven /vs/[slug] system and lives as a standalone
// page; list it here explicitly alongside the data-driven comparisons.
const ALL_COMPARISONS = [
  {
    slug: "upwork",
    name: "Upwork",
    tagline: "Proof-of-work hiring vs resumes and client reviews.",
  },
  ...COMPARISONS.map((c) => ({ slug: c.slug, name: c.name, tagline: c.tagline })),
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
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
  },
};

export default function CompareIndexPage() {
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Compare", item: PAGE_URL },
    ],
  };

  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "VibeTalent platform comparisons",
    url: PAGE_URL,
    itemListElement: ALL_COMPARISONS.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: `VibeTalent vs ${c.name}`,
      url: `${siteUrl}/vs/${c.slug}`,
    })),
  };

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(breadcrumbLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(itemListLd) }}
      />

      <div className="mb-12">
        <div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold text-[var(--foreground)] mb-6"
          style={{
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            boxShadow: "var(--shadow-brutal-xs)",
          }}
        >
          <Lightning weight="fill" size={14} className="text-[var(--accent)]" />
          Compare
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-[var(--foreground)] leading-tight">
          VibeTalent <span className="text-[var(--text-muted)]">vs</span>{" "}
          <span className="text-[var(--accent)]">the alternatives.</span>
        </h1>
        <p className="mt-4 text-[var(--text-secondary)] font-medium leading-relaxed max-w-2xl">
          Every platform below can connect you with developers. Only VibeTalent ranks them on
          verifiable proof of work (coding streaks, shipped projects, and GitHub activity) instead
          of resumes, bids, and reviews. Here is how it stacks up.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {ALL_COMPARISONS.map((c) => (
          <Link
            key={c.slug}
            href={`/vs/${c.slug}`}
            className="block p-6 rounded-2xl transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-brutal-hover)]"
            style={{
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              boxShadow: "var(--shadow-brutal)",
            }}
          >
            <h2 className="text-lg font-bold text-[var(--foreground)] mb-2">
              VibeTalent vs {c.name}
            </h2>
            <p className="text-sm text-[var(--text-secondary)] font-medium leading-relaxed mb-3">
              {c.tagline}
            </p>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)]">
              Read comparison <ArrowRight size={12} />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
