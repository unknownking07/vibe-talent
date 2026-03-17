import { createClient } from "@/lib/supabase/client";
import type { UserWithSocials, HireRequest } from "@/lib/types/database";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = () => createClient() as any;

export async function fetchUsers(): Promise<UserWithSocials[]> {
  const { data: users, error } = await supabase()
    .from("users")
    .select("*")
    .order("vibe_score", { ascending: false });

  if (error || !users) return [];

  const userIds = users.map((u: UserWithSocials) => u.id);

  const { data: projects } = await supabase()
    .from("projects")
    .select("*")
    .in("user_id", userIds);

  const { data: socialLinks } = await supabase()
    .from("social_links")
    .select("*")
    .in("user_id", userIds);

  return users.map((user: UserWithSocials) => ({
    ...user,
    projects: (projects || []).filter((p: { user_id: string }) => p.user_id === user.id),
    social_links: (socialLinks || []).find((s: { user_id: string }) => s.user_id === user.id) || null,
  }));
}

export async function fetchUserByUsername(username: string): Promise<UserWithSocials | null> {
  const { data: user, error } = await supabase()
    .from("users")
    .select("*")
    .eq("username", username)
    .single();

  if (error || !user) return null;

  const { data: projects } = await supabase()
    .from("projects")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const { data: socialLinks } = await supabase()
    .from("social_links")
    .select("*")
    .eq("user_id", user.id)
    .single();

  return {
    ...user,
    projects: projects || [],
    social_links: socialLinks || null,
  };
}

export async function fetchProjects() {
  const { data, error } = await supabase()
    .from("projects")
    .select("*")
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
