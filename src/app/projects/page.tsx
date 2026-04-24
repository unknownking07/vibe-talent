import { fetchAllProjectsCached } from "@/lib/supabase/server-queries";
import { ProjectsContent } from "@/components/projects/projects-content";
import { siteUrl, buildBreadcrumbList } from "@/lib/seo";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "All Projects — Shipped by Vibe Coders | VibeTalent",
  description:
    "Browse all projects shipped by vibe coders. Filter by tech stack, quality score, and more to discover what builders are shipping.",
  alternates: {
    canonical: `${siteUrl}/projects`,
  },
  openGraph: {
    title: "All Projects — VibeTalent",
    description: "Browse all projects shipped by vibe coders. Discover what builders are shipping.",
    url: `${siteUrl}/projects`,
    siteName: "VibeTalent",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "All Projects — VibeTalent",
    description: "Browse all projects shipped by vibe coders. Discover what builders are shipping.",
  },
};

export const revalidate = 60;

export default async function ProjectsPage() {
  let projects: Awaited<ReturnType<typeof fetchAllProjectsCached>>;
  try {
    projects = await fetchAllProjectsCached();
  } catch {
    projects = [];
  }

  const jsonLd = {
    "@context": "https://schema.org",
    ...buildBreadcrumbList([
      { name: "Home", path: "/" },
      { name: "Projects", path: "/projects" },
    ]),
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold uppercase text-[var(--foreground)]">All Projects</h1>
        <p className="mt-2 text-[var(--text-secondary)] font-medium">
          {projects.length} projects shipped by vibe coders
        </p>
      </div>

      <ProjectsContent projects={projects} />
    </div>
  );
}
