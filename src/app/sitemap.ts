import type { MetadataRoute } from "next";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://vibetalent.dev";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages = [
    { url: siteUrl, lastModified: new Date(), changeFrequency: "daily" as const, priority: 1 },
    { url: `${siteUrl}/explore`, lastModified: new Date(), changeFrequency: "daily" as const, priority: 0.9 },
    { url: `${siteUrl}/leaderboard`, lastModified: new Date(), changeFrequency: "daily" as const, priority: 0.8 },
    { url: `${siteUrl}/agent`, lastModified: new Date(), changeFrequency: "weekly" as const, priority: 0.8 },
    { url: `${siteUrl}/agent/find`, lastModified: new Date(), changeFrequency: "weekly" as const, priority: 0.7 },
    { url: `${siteUrl}/agent/chat`, lastModified: new Date(), changeFrequency: "weekly" as const, priority: 0.7 },
    { url: `${siteUrl}/dashboard`, lastModified: new Date(), changeFrequency: "weekly" as const, priority: 0.6 },
  ];

  try {
    const supabase = await createServerSupabaseClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: users } = await (supabase as any).from("users").select("username");

    const profilePages = (users || []).map((user: { username: string }) => ({
      url: `${siteUrl}/profile/${user.username}`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 0.7,
    }));

    return [...staticPages, ...profilePages];
  } catch {
    return staticPages;
  }
}
