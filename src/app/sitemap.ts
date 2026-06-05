import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { siteUrl } from "@/lib/seo";
import { GLOSSARY_TERMS } from "@/lib/glossary";
import { COMPARISONS } from "@/lib/comparisons";

// Regenerate hourly. Google polls sitemaps on its own schedule and the
// per-user `<lastmod>` below already signals freshness to crawlers — no
// reason to rebuild this on every request.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: siteUrl, lastModified: new Date("2026-04-06") },
    { url: `${siteUrl}/explore`, lastModified: new Date("2026-04-01") },
    { url: `${siteUrl}/leaderboard`, lastModified: new Date("2026-04-01") },
    { url: `${siteUrl}/feed`, lastModified: new Date("2026-04-01") },
    { url: `${siteUrl}/projects`, lastModified: new Date() },
    { url: `${siteUrl}/agent`, lastModified: new Date("2026-04-06") },
    { url: `${siteUrl}/about`, lastModified: new Date("2026-04-06") },
    { url: `${siteUrl}/roadmap`, lastModified: new Date("2026-04-23") },
    { url: `${siteUrl}/privacy`, lastModified: new Date("2026-04-06") },
    { url: `${siteUrl}/terms`, lastModified: new Date("2026-04-06") },
    { url: `${siteUrl}/glossary`, lastModified: new Date("2026-05-22") },
    ...GLOSSARY_TERMS.map((t) => ({
      url: `${siteUrl}/glossary/${t.slug}`,
      lastModified: new Date(t.dateModified ?? "2026-05-22"),
    })),
    { url: `${siteUrl}/vs`, lastModified: new Date("2026-06-05") },
    { url: `${siteUrl}/vs/upwork`, lastModified: new Date("2026-05-22") },
    ...COMPARISONS.map((c) => ({
      url: `${siteUrl}/vs/${c.slug}`,
      lastModified: new Date(c.dateModified),
    })),
  ];

  try {
    // Admin client so RLS can't silently filter out profile rows. The
    // previous anon-context query was hiding two failure modes: (a) a
    // typo'd column name that PostgREST rejected, and (b) any future RLS
    // policy that excluded anon reads. Both manifested identically — an
    // empty result swallowed by `catch {}` — which silently dropped every
    // profile URL from the sitemap.
    const supabase = createAdminClient();

    // Only index profiles that have actually done something on the
    // platform — either built a streak or shipped a project. A signed-up
    // account with nothing on it is thin content; including it dilutes
    // site-wide quality signals and gives Google ~empty pages to crawl.
    // Streak-or-project (not just GitHub linked) catches builders who
    // imported projects manually or whose GitHub connect didn't land.
    const [usersResult, projectUserIdsResult] = await Promise.all([
      supabase
        .from("users")
        .select("id, username, created_at, longest_streak")
        .not("username", "is", null),
      supabase.from("projects").select("user_id"),
    ]);

    if (usersResult.error) {
      console.error("[sitemap] users query failed:", usersResult.error);
      return staticPages;
    }
    if (projectUserIdsResult.error) {
      console.error(
        "[sitemap] projects query failed:",
        projectUserIdsResult.error,
      );
      return staticPages;
    }

    type SitemapUser = {
      id: string;
      username: string;
      created_at: string;
      longest_streak: number | null;
    };

    const userIdsWithProjects = new Set(
      (projectUserIdsResult.data ?? []).map(
        (p: { user_id: string }) => p.user_id,
      ),
    );

    const profilePages: MetadataRoute.Sitemap = (
      (usersResult.data ?? []) as SitemapUser[]
    )
      .filter(
        (u) =>
          (u.longest_streak ?? 0) > 0 || userIdsWithProjects.has(u.id),
      )
      .map((user) => ({
        url: `${siteUrl}/profile/${user.username.trim()}`,
        lastModified: new Date(user.created_at),
      }));

    return [...staticPages, ...profilePages];
  } catch (error) {
    // Last-resort fallback. The previous `catch {}` swallowed errors with
    // no signal — a column rename or env-var misconfig delisted every
    // profile from crawl discovery for weeks before the audit caught it.
    // Always log; let Vercel surface this in observability.
    console.error("[sitemap] failed to build profile entries:", error);
    return staticPages;
  }
}
