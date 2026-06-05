import type { Metadata } from "next";
import { jsonLdHtml } from "@/lib/json-ld";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, X, ArrowRight, Flame, Zap, Shield } from "lucide-react";
import { siteUrl } from "@/lib/seo";
import { COMPARISONS, getComparison } from "@/lib/comparisons";

export function generateStaticParams() {
  return COMPARISONS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const c = getComparison(slug);
  if (!c) return { title: "Not found" };

  const url = `${siteUrl}/vs/${c.slug}`;
  return {
    title: c.title,
    description: c.description,
    alternates: { canonical: url },
    openGraph: {
      title: c.title,
      description: c.description,
      url,
      siteName: "VibeTalent",
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: c.title,
      description: c.description,
    },
  };
}

export default async function ComparisonPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const c = getComparison(slug);
  if (!c) notFound();

  const url = `${siteUrl}/vs/${c.slug}`;

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Compare", item: `${siteUrl}/vs` },
      { "@type": "ListItem", position: 3, name: `VibeTalent vs ${c.name}`, item: url },
    ],
  };

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    dateModified: c.dateModified,
    mainEntity: c.faq.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };

  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: c.title,
    description: c.description,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    dateModified: c.dateModified,
    author: { "@type": "Organization", "@id": `${siteUrl}/#organization`, name: "VibeTalent" },
    publisher: { "@type": "Organization", "@id": `${siteUrl}/#organization`, name: "VibeTalent" },
    about: [
      { "@type": "Organization", name: "VibeTalent", url: siteUrl },
      { "@type": "Organization", name: c.name, url: c.competitorUrl },
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
          <span className="text-[var(--accent)]">{c.name}</span>
        </h1>
        <p className="mt-3 text-[var(--text-secondary)] font-medium">{c.subtitle}</p>
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
        <p className="text-base text-[var(--foreground)] font-medium leading-relaxed">{c.tldr}</p>
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
                    {c.name}
                  </th>
                </tr>
              </thead>
              <tbody>
                {c.rows.map((row, i) => (
                  <tr
                    key={row.feature}
                    style={{
                      borderBottom:
                        i === c.rows.length - 1
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
                      {typeof row.them === "boolean" ? (
                        row.them ? (
                          <Check size={18} className="text-[var(--accent)]" />
                        ) : (
                          <X size={18} className="text-[var(--text-muted)]" />
                        )
                      ) : (
                        row.them
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
            {c.vtWins.map((point) => (
              <li key={point}>{point}</li>
            ))}
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
              When {c.name} wins
            </h2>
          </div>
          <ul className="space-y-2 text-sm text-[var(--text-secondary)] font-medium">
            {c.themWins.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* FAQ */}
      <section className="mb-12">
        <h2 className="text-2xl font-extrabold uppercase text-[var(--foreground)] mb-6">
          Frequently asked questions
        </h2>
        <div className="space-y-3">
          {c.faq.map(({ q, a }) => (
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
