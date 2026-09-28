import { fetchAllUsersCached } from "@/lib/supabase/server-queries";
import { jsonLdHtml } from "@/lib/json-ld";
import { ExploreContent } from "@/components/explore/explore-content";
import { defaultSocialImage, siteUrl, buildBreadcrumbList } from "@/lib/seo";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Browse Vibe Coders & AI-Assisted Developers",
  description:
    "Hire AI-assisted developers for web apps, MVPs, and automations. Compare public projects, GitHub activity, and tech stacks, then contact builders directly.",
  alternates: {
    canonical: `${siteUrl}/explore`,
  },
  openGraph: {
    title: "Browse AI-Assisted Developers | VibeTalent",
    description: "Compare shipped projects and contact AI-assisted developers directly.",
    url: `${siteUrl}/explore`,
    siteName: "VibeTalent",
    type: "website",
    images: [{ url: defaultSocialImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    images: [defaultSocialImage],
    title: "Browse AI-Assisted Developers | VibeTalent",
    description: "Compare shipped projects and contact AI-assisted developers directly.",
  },
};

// Browse/ranking data moves on the order of hours (vibe score is recomputed
// daily), so a 5-minute window is generous while cutting background re-renders
// — and their Supabase fan-out — fivefold.
export const revalidate = 300;

export default async function ExplorePage() {
  let users: Awaited<ReturnType<typeof fetchAllUsersCached>>;
  try {
    users = await fetchAllUsersCached();
  } catch {
    users = [];
  }

  const jsonLd = {
    "@context": "https://schema.org",
    ...buildBreadcrumbList([
      { name: "Home", path: "/" },
      { name: "Hire Developers", path: "/explore" },
    ]),
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLd) }}
      />
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[var(--foreground)]">Browse AI-assisted developers</h1>
        <p className="mt-2 text-[var(--text-secondary)] font-medium">
          Compare shipped work, find a builder for your project, and contact them directly.
        </p>
        <p className="mt-3 hidden sm:block text-sm text-[var(--text-muted)] leading-relaxed max-w-3xl">
          Browse developers who use AI coding tools to build web apps, MVPs, and automations.
          Inspect their public projects and repositories, then filter by tech stack or activity.
          GitHub activity is one signal; review the work and discuss your requirements before hiring.
        </p>
        <Link href="/hire-ai-assisted-developers" className="mt-3 inline-block text-sm font-semibold text-[var(--accent)] hover:underline">
          How hiring on VibeTalent works
        </Link>
      </div>

      <ExploreContent users={users} />
    </div>
  );
}
