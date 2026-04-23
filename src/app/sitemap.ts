import type { MetadataRoute } from "next";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/seo";

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
    const supabase = await createServerSupabaseClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: users } = await (supabase as any).from("users").select("username, updated_at");

    const profilePages: MetadataRoute.Sitemap = (users || []).map(
      (user: { username: string; updated_at: string }) => ({
        url: `${siteUrl}/profile/${user.username.trim()}`,
        lastModified: user.updated_at ? new Date(user.updated_at) : new Date(),
      })
    );

    return [...staticPages, ...profilePages];
  } catch {
    return staticPages;
  }
}
