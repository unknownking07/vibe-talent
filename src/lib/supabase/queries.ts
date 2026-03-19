import { createClient } from "@/lib/supabase/client";
import type { UserWithSocials, HireRequest } from "@/lib/types/database";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = () => createClient() as any;

const USER_FIELDS = "id, username, bio, avatar_url, vibe_score, streak, longest_streak, badge_level, created_at";
const PROJECT_FIELDS = "id, user_id, title, description, tech_stack, live_url, github_url, image_url, build_time, tags, verified, created_at";
const SOCIAL_FIELDS = "id, user_id, twitter, telegram, github, website, farcaster";

export async function fetchUsers(): Promise<UserWithSocials[]> {
  const { data: users, error } = await supabase()
    .from("users")
    .select(USER_FIELDS)
    .order("vibe_score", { ascending: false });

  if (error || !users) return [];

  const userIds = users.map((u: UserWithSocials) => u.id);

  const [{ data: projects }, { data: socialLinks }] = await Promise.all([
    supabase()
      .from("projects")
      .select(PROJECT_FIELDS)
      .in("user_id", userIds)
      .eq("flagged", false),
    supabase()
      .from("social_links")
      .select(SOCIAL_FIELDS)
      .in("user_id", userIds),
  ]);

  return users.map((user: UserWithSocials) => ({
    ...user,
    projects: (projects || []).filter((p: { user_id: string }) => p.user_id === user.id),
    social_links: (socialLinks || []).find((s: { user_id: string }) => s.user_id === user.id) || null,
  }));
}

export async function fetchUserByUsername(username: string): Promise<UserWithSocials | null> {
  const { data: user, error } = await supabase()
    .from("users")
    .select(USER_FIELDS)
    .eq("username", username)
    .single();

  if (error || !user) return null;

  const [{ data: projects }, { data: socialLinks }] = await Promise.all([
    supabase()
      .from("projects")
      .select(PROJECT_FIELDS)
      .eq("user_id", user.id)
      .eq("flagged", false)
      .order("created_at", { ascending: false }),
    supabase()
      .from("social_links")
      .select(SOCIAL_FIELDS)
      .eq("user_id", user.id)
      .single(),
  ]);

  return {
    ...user,
    projects: projects || [],
    social_links: socialLinks || null,
  };
}

export async function fetchProjects() {
  const { data, error } = await supabase()
    .from("projects")
    .select(PROJECT_FIELDS)
    .eq("flagged", false)
    .order("created_at", { ascending: false });

  if (error) return [];
  return data;
}

export async function fetchStreakLogs(userId: string): Promise<Record<string, number>> {
  const { data, error } = await supabase()
    .from("streak_logs")
    .select("activity_date")
    .eq("user_id", userId);

  if (error || !data) return {};

  const heatmap: Record<string, number> = {};
  for (const log of data) {
    heatmap[log.activity_date] = (heatmap[log.activity_date] || 0) + 1;
  }
  return heatmap;
}

export async function fetchHireRequests(): Promise<HireRequest[]> {
  const response = await fetch("/api/hire", {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) return [];

  const { data } = await response.json();
  return data || [];
}
