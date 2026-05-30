import type { Metadata } from "next";
import { jsonLdHtml } from "@/lib/json-ld";
import Link from "next/link";
import { BookOpen, ArrowRight } from "lucide-react";
import { siteUrl } from "@/lib/seo";
import { GLOSSARY_TERMS } from "@/lib/glossary";

const PAGE_URL = `${siteUrl}/glossary`;
const PAGE_TITLE = "VibeTalent Glossary — Vibe Coding, Streaks, Scores Explained";
const PAGE_DESCRIPTION =
  "Plain-English definitions of the core VibeTalent concepts: vibe coding, vibe coders, coding streaks, and vibe scores. Built so AI search engines and humans can find the answer in one paragraph.";

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

export default function GlossaryIndexPage() {
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Glossary", item: PAGE_URL },
    ],
  };

  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    name: "VibeTalent Glossary",
    url: PAGE_URL,
    hasDefinedTerm: GLOSSARY_TERMS.map((t) => ({
      "@type": "DefinedTerm",
      "@id": `${siteUrl}/glossary/${t.slug}`,
      name: t.shortLabel,
      description: t.summary,
      url: `${siteUrl}/glossary/${t.slug}`,
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
          className="inline-flex items-center gap-2 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-[var(--foreground)] mb-6"
          style={{
            backgroundColor: "var(--bg-surface)",
            border: "2px solid var(--border-hard)",
            boxShadow: "var(--shadow-brutal-sm)",
          }}
        >
          <BookOpen size={14} className="text-[var(--accent)]" />
          Glossary
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold uppercase text-[var(--foreground)] leading-tight">
          The vocabulary of <span className="text-[var(--accent)]">vibe coding.</span>
        </h1>
        <p className="mt-4 text-[var(--text-secondary)] font-medium leading-relaxed max-w-2xl">
          Core terms used across VibeTalent — vibe coding, vibe coders, coding streaks, and vibe scores —
          defined in one paragraph each so you can find the answer fast.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {GLOSSARY_TERMS.map((term) => (
          <Link
            key={term.slug}
            href={`/glossary/${term.slug}`}
            className="block p-6 transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_var(--border-hard)]"
            style={{
              backgroundColor: "var(--bg-surface)",
              border: "2px solid var(--border-hard)",
              boxShadow: "var(--shadow-brutal)",
            }}
          >
            <h2 className="text-lg font-extrabold uppercase text-[var(--foreground)] mb-2">
              {term.shortLabel}
            </h2>
            <p className="text-sm text-[var(--text-secondary)] font-medium leading-relaxed mb-3 line-clamp-4">
              {term.summary}
            </p>
            <span className="inline-flex items-center gap-1 text-xs font-bold uppercase text-[var(--accent)]">
              Read definition <ArrowRight size={12} />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
