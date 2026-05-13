import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { siteUrl } from "@/lib/seo";

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
  ];

  try {
    // Admin client so RLS can't silently filter out profile rows. The
    // previous anon-context query was hiding two failure modes: (a) a
    // typo'd column name that PostgREST rejected, and (b) any future RLS
    // policy that excluded anon reads. Both manifested identically — an
    // empty result swallowed by `catch {}` — which silently dropped every
    // profile URL from the sitemap.
    const supabase = createAdminClient();
    const { data: users, error } = await supabase
      .from("users")
      .select("username, created_at")
      .not("username", "is", null)
      .not("github_username", "is", null);

    if (error) {
      console.error("[sitemap] users query failed:", error);
      return staticPages;
    }

    const profilePages: MetadataRoute.Sitemap = (users ?? []).map(
      (user: { username: string; created_at: string }) => ({
        url: `${siteUrl}/profile/${user.username.trim()}`,
        lastModified: new Date(user.created_at),
      }),
    );

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
