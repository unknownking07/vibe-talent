import Link from "next/link";
import { jsonLdHtml } from "@/lib/json-ld";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { fetchUserByUsernameCached, fetchPrivateProjectsForOwner } from "@/lib/supabase/server-queries";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ProfileProjectCard } from "@/components/profile/profile-project-card";
import { siteUrl } from "@/lib/seo";

// Mirror the same username shape we accept in the page handler below — keeps
// metadata generation cheap for the obvious garbage paths (bots probing for
// admin/.env/etc.) instead of round-tripping to Supabase first.
const USERNAME_PATTERN = /^[a-zA-Z0-9_.\- ]+$/;
const USERNAME_MAX_LENGTH = 50;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username: rawMeta } = await params;
  const username = rawMeta?.trim();
  if (!username || username.length > USERNAME_MAX_LENGTH || !USERNAME_PATTERN.test(username)) {
    return { title: "Builder Not Found" };
  }
  const user = await fetchUserByUsernameCached(username);

  if (!user) {
    return { title: "Builder Not Found" };
  }

  const projectCount = (user.projects ?? []).length;
  const title = `@${user.username}'s projects — VibeTalent`;
  const description = `All ${projectCount} project${projectCount === 1 ? "" : "s"} shipped by @${user.username} on VibeTalent.`;

  return {
    title,
    description,
    alternates: {
      canonical: `${siteUrl}/profile/${username}/projects`,
    },
    openGraph: {
      title,
      description,
      url: `${siteUrl}/profile/${username}/projects`,
      type: "profile",
      images: [
        {
          url: `${siteUrl}/profile/${username}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: `@${username} on VibeTalent`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${siteUrl}/profile/${username}/opengraph-image`],
    },
  };
}

export const revalidate = 3600;

export default async function UserProjectsPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username: rawUsername } = await params;
  const username = rawUsername?.trim();

  if (!username || username.length > USERNAME_MAX_LENGTH || !USERNAME_PATTERN.test(username)) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-20 text-center">
        <h1 className="text-2xl font-extrabold uppercase text-[var(--foreground)]">Invalid username</h1>
        <p className="mt-2 text-[var(--text-secondary)] font-medium">This is not a valid username.</p>
      </div>
    );
  }

  const user = await fetchUserByUsernameCached(username);

  if (!user) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-20 text-center">
        <h1 className="text-2xl font-extrabold uppercase text-[var(--foreground)]">Builder not found</h1>
        <p className="mt-2 text-[var(--text-secondary)] font-medium">@{username} does not exist on VibeTalent.</p>
      </div>
    );
  }

  let isOwner = false;
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    isOwner = authUser?.id === user.id;
  } catch {
    // not logged in
  }

  // Owner sees their private projects merged in with the public ones.
  if (isOwner) {
    const privateProjects = await fetchPrivateProjectsForOwner(user.id);
    if (privateProjects.length > 0) {
      user.projects = [...privateProjects, ...(user.projects ?? [])];
    }
  }

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Explore", item: `${siteUrl}/explore` },
      { "@type": "ListItem", position: 3, name: `@${user.username}`, item: `${siteUrl}/profile/${user.username}` },
      { "@type": "ListItem", position: 4, name: "Projects", item: `${siteUrl}/profile/${user.username}/projects` },
    ],
  };

  const projects = user.projects ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(breadcrumbLd) }}
      />

      <Link
        href={`/profile/${user.username}`}
        className="inline-flex items-center gap-1.5 text-sm font-bold uppercase text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors mb-6"
      >
        <ArrowLeft size={14} />
        Back to profile
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-extrabold uppercase text-[var(--foreground)]">
          @{user.username}&apos;s Projects
        </h1>
        <p className="mt-2 text-[var(--text-secondary)] font-medium">
          {projects.length} project{projects.length === 1 ? "" : "s"} shipped
        </p>
      </div>

      {projects.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
          {projects.map((project) => (
            <ProfileProjectCard
              key={project.id}
              project={project}
              verified={!!project.verified}
              isOwner={isOwner}
            />
          ))}
        </div>
      ) : (
        <div
          className="p-8 text-center font-bold uppercase text-[var(--text-muted)]"
          style={{
            backgroundColor: "var(--bg-surface)",
            border: "2px solid var(--border-hard)",
          }}
        >
          No projects yet.
        </div>
      )}
    </div>
  );
}
