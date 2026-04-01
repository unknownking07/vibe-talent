import type { MetadataRoute } from "next";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const siteUrl = "https://www.vibetalent.work";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: siteUrl, lastModified: new Date("2026-03-15") },
    { url: `${siteUrl}/explore`, lastModified: new Date("2026-03-15") },
    { url: `${siteUrl}/leaderboard`, lastModified: new Date("2026-03-15") },
    { url: `${siteUrl}/feed`, lastModified: new Date("2026-03-15") },
    { url: `${siteUrl}/agent`, lastModified: new Date("2026-03-15") },
    { url: `${siteUrl}/agent/find`, lastModified: new Date("2026-03-15") },
    { url: `${siteUrl}/agent/chat`, lastModified: new Date("2026-03-15") },
  ];

  try {
    const supabase = await createServerSupabaseClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: users } = await (supabase as any).from("users").select("username, updated_at");

    const profilePages: MetadataRoute.Sitemap = (users || []).map(
      (user: { username: string; updated_at: string }) => ({
        url: `${siteUrl}/profile/${user.username.trim()}`,
        lastModified: user.updated_at ? new Date(user.updated_at) : new Date("2026-03-15"),
      })
    );

    return [...staticPages, ...profilePages];
  } catch {
    return staticPages;
  }
}
