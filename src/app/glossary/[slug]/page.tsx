import type { Metadata } from "next";
import { jsonLdHtml } from "@/lib/json-ld";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { BookOpen } from "@phosphor-icons/react/dist/ssr";
import { siteUrl } from "@/lib/seo";
import { GLOSSARY_TERMS, getGlossaryTerm } from "@/lib/glossary";

export async function generateStaticParams() {
  return GLOSSARY_TERMS.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const term = getGlossaryTerm(slug);
  if (!term) return { title: "Not found" };

  const url = `${siteUrl}/glossary/${term.slug}`;
  return {
    title: term.title,
    description: term.metaDescription,
    alternates: { canonical: url },
    openGraph: {
      title: term.title,
      description: term.metaDescription,
      url,
      siteName: "VibeTalent",
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: term.title,
      description: term.metaDescription,
    },
  };
}

export default async function GlossaryTermPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const term = getGlossaryTerm(slug);
  if (!term) notFound();

  const url = `${siteUrl}/glossary/${term.slug}`;

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Glossary", item: `${siteUrl}/glossary` },
      { "@type": "ListItem", position: 3, name: term.shortLabel, item: url },
    ],
  };

  const definedTermLd = {
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    "@id": url,
    name: term.shortLabel,
    description: term.summary,
    url,
    inDefinedTermSet: {
      "@type": "DefinedTermSet",
      "@id": `${siteUrl}/glossary`,
      name: "VibeTalent Glossary",
      url: `${siteUrl}/glossary`,
    },
    dateModified: term.dateModified ?? "2026-05-22",
  };

  const related = term.related
    .map((slug) => getGlossaryTerm(slug))
    .filter((t): t is NonNullable<typeof t> => Boolean(t));

  return (
    <article className="mx-auto max-w-3xl px-4 sm:px-6 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(breadcrumbLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(definedTermLd) }}
      />

      <Link
        href="/glossary"
        className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--accent)] mb-6"
      >
        <ArrowLeft size={12} /> Glossary
      </Link>

      <div
        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold text-[var(--foreground)] mb-6"
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          boxShadow: "var(--shadow-brutal-xs)",
        }}
      >
        <BookOpen weight="fill" size={14} className="text-[var(--accent)]" />
        Definition
      </div>

      <h1 className="text-3xl sm:text-4xl font-bold text-[var(--foreground)] leading-tight mb-6">
        {term.title}
      </h1>

      {/* Answer block — the 35-90 word summary lives here so AI engines and
          humans both get the answer in the first paragraph, not buried below. */}
      <div
        className="p-6 sm:p-8 mb-8 rounded-2xl"
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          boxShadow: "var(--shadow-brutal)",
        }}
      >
        <p className="text-base text-[var(--foreground)] font-medium leading-relaxed">
          {term.summary}
        </p>
      </div>

      <div className="space-y-5 text-sm sm:text-base text-[var(--text-secondary)] font-medium leading-relaxed">
        {term.body.map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
      </div>

      {related.length > 0 && (
        <section className="mt-12 pt-8" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <h2 className="text-lg font-bold text-[var(--foreground)] mb-4">
            Related terms
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {related.map((r) => (
              <Link
                key={r.slug}
                href={`/glossary/${r.slug}`}
                className="block p-4 rounded-2xl transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-brutal-hover)]"
                style={{
                  backgroundColor: "var(--bg-surface)",
                  border: "1px solid var(--border-subtle)",
                  boxShadow: "var(--shadow-brutal-sm)",
                }}
              >
                <h3 className="text-sm font-bold text-[var(--foreground)] mb-1">
                  {r.shortLabel}
                </h3>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)]">
                  Read <ArrowRight size={11} />
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-12 p-6 sm:p-8 text-center rounded-2xl"
        style={{
          backgroundColor: "var(--bg-inverted)",
          border: "1px solid var(--border-subtle)",
          boxShadow: "var(--shadow-brutal-accent)",
        }}
      >
        <h2 className="text-xl sm:text-2xl font-bold text-white mb-3">
          See it in practice
        </h2>
        <p className="text-sm text-[var(--text-muted-soft)] font-medium mb-5 max-w-md mx-auto">
          Browse builders ranked by streak, project quality, and vibe score on the live VibeTalent leaderboard.
        </p>
        <Link
          href="/leaderboard"
          className="btn-brutal btn-brutal-accent inline-flex items-center gap-2"
        >
          View leaderboard <ArrowRight size={14} />
        </Link>
      </section>
    </article>
  );
}
