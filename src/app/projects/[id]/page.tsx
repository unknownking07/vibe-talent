import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { fetchPublicProjectByIdCached } from "@/lib/supabase/server-queries";
import { isIndexableProject } from "@/lib/seo-projects";
import { jsonLdHtml } from "@/lib/json-ld";
import { normalizeExternalUrl, normalizeRepoUrl } from "@/lib/url-normalize";
import { siteUrl } from "@/lib/seo";

type Props = { params: Promise<{ id: string }> };

export const revalidate = 300;

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const project = await fetchPublicProjectByIdCached(id);
  if (!project) notFound();

  const pageUrl = `${siteUrl}/projects/${project.id}`;
  const description = project.description.trim().slice(0, 155);
  const title = project.users?.username
    ? `${project.title} — Project by @${project.users.username}`
    : `${project.title} — VibeTalent Project`;
  const index = isIndexableProject(project) && Boolean(project.users?.username);

  return {
    title,
    description,
    robots: { index, follow: true },
    alternates: { canonical: pageUrl },
    openGraph: {
      title,
      description,
      url: pageUrl,
      siteName: "VibeTalent",
      type: "article",
      ...(project.image_url ? { images: [{ url: project.image_url }] } : {}),
    },
  };
}

export default async function ProjectPage({ params }: Props) {
  const { id } = await params;
  const project = await fetchPublicProjectByIdCached(id);
  if (!project) notFound();

  const liveUrl = normalizeExternalUrl(project.live_url);
  const repoUrl = normalizeRepoUrl(project.github_url);
  const username = project.users?.username;
  const pageUrl = `${siteUrl}/projects/${project.id}`;
  const projectLd = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: project.title,
    description: project.description,
    url: pageUrl,
    dateCreated: project.created_at,
    ...(username
      ? { author: { "@type": "Person", name: project.users?.display_name || username, url: `${siteUrl}/profile/${username}` } }
      : {}),
    ...(repoUrl ? { codeRepository: repoUrl } : {}),
    ...(liveUrl ? { sameAs: liveUrl } : {}),
  };

  return (
    <main className="mx-auto max-w-5xl px-4 sm:px-6 py-12 sm:py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(projectLd) }}
      />
      <nav aria-label="Breadcrumb" className="text-sm text-[var(--text-muted)]">
        <Link href="/projects" className="hover:text-[var(--accent)]">Projects</Link>
        <span aria-hidden="true"> / </span>
        <span>{project.title}</span>
      </nav>

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_280px]">
        <article>
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--accent)]">
            Shipped project {project.verified ? "· GitHub owner verified" : ""}
          </p>
          <h1 className="mt-3 text-4xl sm:text-5xl font-extrabold leading-tight text-[var(--foreground)]">
            {project.title}
          </h1>
          {username && (
            <p className="mt-4 text-[var(--text-secondary)]">
              Built by{" "}
              <Link href={`/profile/${username}`} className="font-semibold text-[var(--accent)] hover:underline">
                {project.users?.display_name || `@${username}`}
              </Link>
            </p>
          )}
          {project.image_url && (
            <div className="relative mt-8 aspect-video overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
              <Image
                src={project.image_url}
                alt={`Screenshot of ${project.title}`}
                fill
                sizes="(max-width: 1024px) 100vw, 700px"
                className="object-cover"
              />
            </div>
          )}
          <section className="mt-10">
            <h2 className="text-2xl font-bold text-[var(--foreground)]">What the builder shipped</h2>
            <p className="mt-4 whitespace-pre-wrap leading-relaxed text-[var(--text-secondary)]">
              {project.description}
            </p>
          </section>
          {project.tech_stack?.length > 0 && (
            <section className="mt-10">
              <h2 className="text-xl font-bold text-[var(--foreground)]">Tech stack</h2>
              <ul className="mt-4 flex flex-wrap gap-2">
                {project.tech_stack.map((tech) => (
                  <li key={tech} className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1 text-sm text-[var(--text-secondary)]">
                    {tech}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </article>

        <aside className="h-fit rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-[var(--shadow-brutal-sm)]">
          <h2 className="text-lg font-bold text-[var(--foreground)]">Inspect this work</h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
            Open the live project and repository, then ask the builder what they contributed.
          </p>
          <div className="mt-5 flex flex-col gap-3">
            {liveUrl && (
              <a href={liveUrl} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-[var(--accent)] px-4 py-3 text-center text-sm font-semibold text-white hover:bg-[var(--accent-hover)]">
                Open live project
              </a>
            )}
            {repoUrl && (
              <a href={repoUrl} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-[var(--border-subtle)] px-4 py-3 text-center text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--bg-surface-light)]">
                View repository
              </a>
            )}
            {username && (
              <Link href={`/profile/${username}`} className="rounded-xl border border-[var(--border-subtle)] px-4 py-3 text-center text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--bg-surface-light)]">
                View builder profile
              </Link>
            )}
          </div>
          <p className="mt-5 text-xs leading-relaxed text-[var(--text-muted)]">
            Verification and quality signals are context for your review, not a guarantee of delivery.
          </p>
        </aside>
      </div>

      <div className="mt-16 border-t border-[var(--border-subtle)] pt-8">
        <Link href="/hire-ai-assisted-developers" className="font-semibold text-[var(--accent)] hover:underline">
          Find developers for your project
        </Link>
      </div>
    </main>
  );
}
