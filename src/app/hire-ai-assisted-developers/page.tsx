import type { Metadata } from "next";
import Link from "next/link";
import { fetchAllProjectsCached } from "@/lib/supabase/server-queries";
import type { Project } from "@/lib/types/database";
import { jsonLdHtml } from "@/lib/json-ld";
import { siteUrl } from "@/lib/seo";
import { isIndexableProject } from "@/lib/seo-projects";

const pageUrl = `${siteUrl}/hire-ai-assisted-developers`;
const title = "Hire AI-Assisted Developers";
const description =
  "Find AI-assisted developers for web apps, MVPs, and automations. Compare shipped projects and public GitHub activity, then contact builders directly on VibeTalent.";

type PublicProject = Project & {
  users?: { username: string | null; display_name: string | null } | null;
};

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: pageUrl },
  openGraph: {
    title: `${title} | VibeTalent`,
    description,
    url: pageUrl,
    siteName: "VibeTalent",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${title} | VibeTalent`,
    description,
  },
};

export const revalidate = 300;

const workTypes = [
  {
    title: "MVPs and web apps",
    body: "Find a builder who has shipped usable products, then discuss the scope and the decisions that matter for your first release.",
  },
  {
    title: "Automations and integrations",
    body: "Compare relevant repositories and live work before asking a builder to connect tools, data, and workflows.",
  },
  {
    title: "Existing product improvements",
    body: "Shortlist developers whose work shows the stack and level of care your current product needs.",
  },
];

export default async function HireAiAssistedDevelopersPage() {
  let examples: PublicProject[] = [];
  try {
    const projects = (await fetchAllProjectsCached()) as PublicProject[];
    examples = projects
      .filter(
        (project) =>
          isIndexableProject(project) &&
          project.users?.username,
      )
      .sort((a, b) => b.quality_score - a.quality_score)
      .slice(0, 3);
  } catch (error) {
    console.error("[hire-ai-assisted-developers] Failed to load projects:", error);
  }

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: title, item: pageUrl },
    ],
  };

  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-6 py-12 sm:py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(breadcrumbLd) }}
      />
      <div className="max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-widest text-[var(--accent)]">
          Hire through real work
        </p>
        <h1 className="mt-4 text-4xl sm:text-6xl font-extrabold leading-tight text-[var(--foreground)]">
          Hire AI-assisted developers
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-[var(--text-secondary)]">
          VibeTalent is a marketplace for finding builders of web apps, MVPs,
          and automations. Compare projects you can open, inspect public
          repositories, and contact the people whose experience matches your brief.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/agent/find"
            className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--accent)] px-6 font-semibold text-white hover:bg-[var(--accent-hover)]"
          >
            Describe your project
          </Link>
          <Link
            href="/explore"
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-6 font-semibold text-[var(--foreground)] hover:bg-[var(--bg-surface-light)]"
          >
            Browse builders
          </Link>
        </div>
        <p className="mt-4 text-sm text-[var(--text-muted)]">
          Browse and contact builders without a VibeTalent platform fee. Agree
          on scope, price, and payment terms directly with your builder.
        </p>
      </div>

      <section className="mt-16">
        <h2 className="text-2xl sm:text-3xl font-bold text-[var(--foreground)]">
          What can you hire a builder to make?
        </h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {workTypes.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-[var(--shadow-brutal-sm)]"
            >
              <h3 className="text-lg font-bold text-[var(--foreground)]">{item.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {examples.length > 0 && (
        <section className="mt-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-[var(--foreground)]">
                Inspect shipped work
              </h2>
              <p className="mt-2 text-[var(--text-secondary)]">
                Public projects with a linked repository and live site.
              </p>
            </div>
            <Link href="/projects" className="font-semibold text-[var(--accent)] hover:underline">
              Browse all projects
            </Link>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {examples.map((project) => (
              <article
                key={project.id}
                className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-[var(--shadow-brutal-sm)]"
              >
                <h3 className="text-lg font-bold text-[var(--foreground)]">
                  <Link href={`/projects/${project.id}`} className="hover:text-[var(--accent)]">
                    {project.title}
                  </Link>
                </h3>
                <p className="mt-3 line-clamp-4 text-sm leading-relaxed text-[var(--text-secondary)]">
                  {project.description}
                </p>
                <p className="mt-4 text-xs text-[var(--text-muted)]">
                  {project.tech_stack?.slice(0, 4).join(" · ")}
                </p>
                <Link
                  href={`/profile/${project.users!.username}`}
                  className="mt-4 inline-block text-sm font-semibold text-[var(--accent)] hover:underline"
                >
                  Meet @{project.users!.username}
                </Link>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="mt-16 rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-7 sm:p-10">
        <h2 className="text-2xl sm:text-3xl font-bold text-[var(--foreground)]">
          How hiring works
        </h2>
        <ol className="mt-6 grid gap-6 md:grid-cols-3">
          <li>
            <span className="text-xs font-bold text-[var(--accent)]">01 / DEFINE</span>
            <h3 className="mt-2 font-bold text-[var(--foreground)]">Share the outcome</h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
              Describe what you need built, your timeline, and the skills that matter.
            </p>
          </li>
          <li>
            <span className="text-xs font-bold text-[var(--accent)]">02 / COMPARE</span>
            <h3 className="mt-2 font-bold text-[var(--foreground)]">Review real work</h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
              Open projects and repositories, and ask candidates how they built them.
            </p>
          </li>
          <li>
            <span className="text-xs font-bold text-[var(--accent)]">03 / CONTACT</span>
            <h3 className="mt-2 font-bold text-[var(--foreground)]">Talk directly</h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
              Discuss scope and terms with the builder. A small paid trial can help you assess fit.
            </p>
          </li>
        </ol>
      </section>

      <section className="mt-16 max-w-3xl">
        <h2 className="text-2xl sm:text-3xl font-bold text-[var(--foreground)]">
          What does VibeTalent verify?
        </h2>
        <p className="mt-4 leading-relaxed text-[var(--text-secondary)]">
          VibeTalent connects builder profiles to public GitHub activity and
          displays project links and repository quality signals. These help you
          inspect a candidate&apos;s work, but a streak or score cannot guarantee
          code quality, ownership of every contribution, or delivery on your
          project. Check the live work, ask questions, and agree on a clear scope.
        </p>
        <p className="mt-4 text-sm text-[var(--text-secondary)]">
          Still researching? Read our{" "}
          <Link href="/hire-vibe-coders" className="font-semibold text-[var(--accent)] hover:underline">
            practical guide to hiring vibe coders
          </Link>
          .
        </p>
      </section>

      <div className="mt-16 border-t border-[var(--border-subtle)] pt-8">
        <Link
          href="/agent/find"
          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--accent)] px-6 font-semibold text-white hover:bg-[var(--accent-hover)]"
        >
          Find builders for your project
        </Link>
      </div>
    </main>
  );
}
