import type { MetadataRoute } from "next";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/seo";

const fallbackLastModified = new Date("2026-03-15");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: siteUrl, lastModified: fallbackLastModified },
    { url: `${siteUrl}/explore`, lastModified: fallbackLastModified },
    { url: `${siteUrl}/leaderboard`, lastModified: fallbackLastModified },
    { url: `${siteUrl}/feed`, lastModified: fallbackLastModified },
    { url: `${siteUrl}/agent`, lastModified: fallbackLastModified },
    { url: `${siteUrl}/agent/find`, lastModified: fallbackLastModified },
    { url: `${siteUrl}/agent/chat`, lastModified: fallbackLastModified },
  ];

  try {
    const supabase = await createServerSupabaseClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: users } = await (supabase as any).from("users").select("username, updated_at");

    const profilePages: MetadataRoute.Sitemap = (users || []).map(
      (user: { username: string; updated_at: string }) => ({
        url: `${siteUrl}/profile/${user.username.trim()}`,
        lastModified: user.updated_at ? new Date(user.updated_at) : fallbackLastModified,
      })
    );

    return [...staticPages, ...profilePages];
  } catch {
    return staticPages;
  }
}
