import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import type { UserWithSocials } from "@/lib/types/database";

const USER_FIELDS = "id, username, display_name, bio, avatar_url, github_username, vibe_score, streak, longest_streak, badge_level, created_at";
const PROJECT_FIELDS = "id, user_id, title, description, tech_stack, live_url, github_url, image_url, build_time, tags, verified, quality_score, quality_metrics, endorsement_count, created_at";
const SOCIAL_FIELDS = "id, user_id, twitter, telegram, github, website, farcaster";

// Cookie-free client for use inside unstable_cache (no auth context needed for public reads)
function getPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

async function _fetchAllUsers(): Promise<UserWithSocials[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = getPublicClient() as any;

  const { data: users, error } = await sb
    .from("users")
    .select(USER_FIELDS)
    .not("username", "is", null)
    .order("vibe_score", { ascending: false });

  // Throw on error so unstable_cache does NOT cache empty results
  if (error) {
    throw new Error(`Failed to fetch users: ${error.message}`);
  }
  if (!users || users.length === 0) return [];

  const userIds = users.map((u: UserWithSocials) => u.id);

  const [{ data: projects }, { data: socialLinks }, { data: latestLogs }] = await Promise.all([
    sb
      .from("projects")
      .select(PROJECT_FIELDS)
      .in("user_id", userIds),
    sb
      .from("social_links")
      .select(SOCIAL_FIELDS)
      .in("user_id", userIds),
    sb
      .from("streak_logs")
      .select("user_id, activity_date")
      .in("user_id", userIds)
      .order("activity_date", { ascending: false }),
  ]);

  // Build a map of user_id -> latest activity_date
  const lastActivityMap: Record<string, string> = {};
  for (const log of (latestLogs || [])) {
    if (!lastActivityMap[log.user_id]) {
      lastActivityMap[log.user_id] = log.activity_date;
    }
  }

  return users.map((user: UserWithSocials) => ({
    ...user,
    projects: (projects || []).filter((p: { user_id: string }) => p.user_id === user.id),
    social_links: (socialLinks || []).find((s: { user_id: string }) => s.user_id === user.id) || null,
    last_activity_date: lastActivityMap[user.id] || null,
  }));
}

async function _fetchUserByUsername(username: string): Promise<UserWithSocials | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = getPublicClient() as any;

  const { data: user, error } = await sb
    .from("users")
    .select(USER_FIELDS)
    .eq("username", username)
    .single();

  // PGRST116 = "not found" (single row expected but 0 returned) — legitimate null
  if (error && error.code !== "PGRST116") {
    throw new Error(`Failed to fetch user "${username}": ${error.message}`);
  }
  if (!user) return null;

  const [{ data: projects }, { data: socialLinks }] = await Promise.all([
    sb
      .from("projects")
      .select(PROJECT_FIELDS)
      .eq("user_id", user.id)
            .order("created_at", { ascending: false }),
    sb
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

async function _fetchStreakLogs(userId: string): Promise<Record<string, number>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = getPublicClient() as any;

  const { data, error } = await sb
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

// Homepage data — single cached function for all homepage queries
async function _fetchHomepageData() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = getPublicClient() as any;

  const [usersResult, projectsResult, builderCountResult, projectCountResult, streakResult] = await Promise.all([
    sb.from("users").select(USER_FIELDS).not("username", "is", null).order("vibe_score", { ascending: false }).limit(20),
    sb.from("projects").select(`${PROJECT_FIELDS}, users!projects_user_id_fkey(username)`).not("live_url", "is", null).order("created_at", { ascending: false }).limit(3),
    sb.from("users").select("id", { count: "exact", head: true }).not("username", "is", null),
    sb.from("projects").select("id", { count: "exact", head: true }),
    sb.from("users").select("streak").not("username", "is", null),
  ]);

  // If critical queries failed, throw so unstable_cache does NOT cache zeros
  if (builderCountResult.error || projectCountResult.error) {
    throw new Error(
      `Homepage stats query failed: ${builderCountResult.error?.message || ""} ${projectCountResult.error?.message || ""}`.trim()
    );
  }

  const allUsers = usersResult.data;
  const featuredProjects = projectsResult.data || [];
  const totalBuilders = builderCountResult.count || 0;
  const totalProjects = projectCountResult.count || 0;
  const streakData = streakResult.data;

  let avgStreak = 0;
  if (streakData && streakData.length > 0) {
    const sum = streakData.reduce((acc: number, u: { streak: number }) => acc + u.streak, 0);
    avgStreak = Math.round(sum / streakData.length);
  }

  let topVibecoders: UserWithSocials[] = [];
  if (allUsers && allUsers.length > 0) {
    const allUserIds = allUsers.map((u: { id: string }) => u.id);
    const [{ data: allProjects }, { data: socials }] = await Promise.all([
      sb.from("projects").select(PROJECT_FIELDS).in("user_id", allUserIds),
      sb.from("social_links").select(SOCIAL_FIELDS).in("user_id", allUserIds),
    ]);

    const usersWithProjects = allUsers
      .filter((u: { id: string }) => (allProjects || []).some((p: { user_id: string }) => p.user_id === u.id))
      .slice(0, 3);

    topVibecoders = usersWithProjects.map((u: import("@/lib/types/database").User) => ({
      ...u,
      projects: (allProjects || []).filter((p: { user_id: string }) => p.user_id === u.id),
      social_links: (socials || []).find((s: { user_id: string }) => s.user_id === u.id) || null,
    }));
  }

  return { topVibecoders, featuredProjects, totalBuilders, totalProjects, avgStreak };
}

export const fetchHomepageDataCached = unstable_cache(
  _fetchHomepageData,
  ["homepage-data"],
  { revalidate: 60 }
);

// Cached versions — revalidate every 60 seconds
export const fetchAllUsersCached = unstable_cache(
  _fetchAllUsers,
  ["all-users"],
  { revalidate: 60 }
);

export const fetchUserByUsernameCached = (username: string) =>
  unstable_cache(
    () => _fetchUserByUsername(username),
    [`user-${username}`],
    { revalidate: 60 }
  )();

export const fetchStreakLogsCached = (userId: string) =>
  unstable_cache(
    () => _fetchStreakLogs(userId),
    [`streak-logs-${userId}`],
    { revalidate: 60 }
  )();
