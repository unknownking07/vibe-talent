import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { UserWithSocials } from "@/lib/types/database";

const USER_FIELDS = "id, username, display_name, bio, avatar_url, github_username, vibe_score, streak, longest_streak, badge_level, created_at";
const PROJECT_FIELDS = "id, user_id, title, description, tech_stack, live_url, github_url, image_url, build_time, tags, verified, quality_score, quality_metrics, endorsement_count, is_private, created_at";
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
    // Listings + leaderboard never expose private repos.
    sb
      .from("projects")
      .select(PROJECT_FIELDS)
      .in("user_id", userIds)
      .eq("is_private", false),
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

  const projectMap = new Map<string, typeof projects>();
  for (const p of (projects || [])) {
    const arr = projectMap.get(p.user_id) || [];
    arr.push(p);
    projectMap.set(p.user_id, arr);
  }
  const socialMap = new Map((socialLinks || []).map((s: { user_id: string }) => [s.user_id, s]));

  return users.map((user: UserWithSocials) => ({
    ...user,
    projects: projectMap.get(user.id) || [],
    social_links: socialMap.get(user.id) || null,
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
    // Public profile fetch: private repos are excluded here. The profile page
    // does a separate uncached read for owners so they still see their own
    // private projects with a 🔒 badge.
    sb
      .from("projects")
      .select(PROJECT_FIELDS)
      .eq("user_id", user.id)
      .eq("is_private", false)
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
    sb.from("projects").select(`${PROJECT_FIELDS}, users!projects_user_id_fkey(username)`).not("live_url", "is", null).eq("is_private", false).order("created_at", { ascending: false }).limit(3),
    sb.from("users").select("id", { count: "exact", head: true }).not("username", "is", null),
    sb.from("projects").select("id", { count: "exact", head: true }).eq("is_private", false),
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
      sb.from("projects").select(PROJECT_FIELDS).in("user_id", allUserIds).eq("is_private", false),
      sb.from("social_links").select(SOCIAL_FIELDS).in("user_id", allUserIds),
    ]);

    const projectsByUser = new Map<string, typeof allProjects>();
    for (const p of (allProjects || [])) {
      const arr = projectsByUser.get(p.user_id) || [];
      arr.push(p);
      projectsByUser.set(p.user_id, arr);
    }
    const socialsByUser = new Map((socials || []).map((s: { user_id: string }) => [s.user_id, s]));

    const usersWithProjects = allUsers
      .filter((u: { id: string }) => projectsByUser.has(u.id))
      .slice(0, 3);

    topVibecoders = usersWithProjects.map((u: import("@/lib/types/database").User) => ({
      ...u,
      projects: projectsByUser.get(u.id) || [],
      social_links: socialsByUser.get(u.id) || null,
    }));
  }

  return { topVibecoders, featuredProjects, totalBuilders, totalProjects, avgStreak };
}

export const fetchHomepageDataCached = unstable_cache(
  _fetchHomepageData,
  ["homepage-data"],
  { revalidate: 60 }
);

// All projects with author info for /projects page
async function _fetchAllProjects() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = getPublicClient() as any;

  const { data: projects, error } = await sb
    .from("projects")
    .select(`${PROJECT_FIELDS}, users!projects_user_id_fkey(username, display_name, avatar_url, badge_level)`)
    .eq("flagged", false)
    .eq("is_private", false)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch projects: ${error.message}`);
  }

  return projects || [];
}

export const fetchAllProjectsCached = unstable_cache(
  _fetchAllProjects,
  ["all-projects"],
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
    { revalidate: 60, tags: [`user-${username}`] }
  )();

/**
 * Owner-only fetch for a user's private projects. Kept out of the cached
 * profile fetch so the same cached response can never leak to a non-owner
 * viewer. Callers must verify the requesting user owns the row before
 * merging the results into a profile view.
 *
 * Uses the cookie-aware server client (NOT the anon getPublicClient) on
 * purpose: the projects RLS policy only returns private rows when
 * `auth.uid() = user_id`, and that predicate is null under the anon key —
 * so an anon client would always return [] here and silently hide the
 * owner's own private projects. The authenticated client carries the
 * owner's session JWT so RLS matches. This is also why it can't be wrapped
 * in unstable_cache (cookies() isn't allowed there).
 */
export async function fetchPrivateProjectsForOwner(userId: string): Promise<import("@/lib/types/database").Project[]> {
  // Keep the generic SupabaseClient<Database> typing from
  // createServerSupabaseClient — no `as any` cast — so the projects query is
  // type-checked against the schema.
  const sb = await createServerSupabaseClient();
  const { data, error } = await sb
    .from("projects")
    .select(PROJECT_FIELDS)
    .eq("user_id", userId)
    .eq("is_private", true)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data as unknown as import("@/lib/types/database").Project[];
}

export const fetchStreakLogsCached = (userId: string) =>
  unstable_cache(
    () => _fetchStreakLogs(userId),
    [`streak-logs-${userId}`],
    { revalidate: 60 }
  )();

// ---------------------------------------------------------------------------
// Proof wall (homepage hero)
// ---------------------------------------------------------------------------

export interface ProofWallData {
  /** ISO dates, oldest -> newest, spanning the wall window. */
  days: string[];
  /** One row per builder; cells keyed by ISO date -> commit count. */
  rows: { username: string; cells: Record<string, number> }[];
  totalBuilderDays: number;
  longestStreak: number;
  buildersTracked: number;
}

const PROOF_WALL_DAYS = 70;
const PROOF_WALL_ROWS = 8;

async function _fetchProofWall(): Promise<ProofWallData> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = getPublicClient() as any;

  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - (PROOF_WALL_DAYS - 1));
  const cutoffIso = cutoff.toISOString().slice(0, 10);

  // Pick the builders FIRST, then fetch only their logs.
  //
  // The obvious version (scan every log in the window, rank by row count)
  // cannot work: PostgREST enforces a server-side max-rows of 1000, which
  // `.range()` cannot raise, and the window holds ~3.9k rows. That silently
  // returned an arbitrary 1000-row slice covering only ~20 of the 70 days, so
  // the wall rendered three weeks and looked broken. Selecting 8 builders up
  // front bounds the log query at 8 x 70 = 560 rows, comfortably under the cap.
  const [topUsersRes, totalRes, buildersRes] = await Promise.all([
    sb
      .from("users")
      .select("id, username, longest_streak")
      .not("username", "is", null)
      .order("longest_streak", { ascending: false })
      .limit(PROOF_WALL_ROWS),
    sb.from("streak_logs").select("*", { count: "exact", head: true }),
    sb.from("users").select("id", { count: "exact", head: true }).not("username", "is", null),
  ]);

  // Throw on error so unstable_cache does NOT cache an empty wall
  if (topUsersRes.error) throw new Error(`Failed to fetch proof wall builders: ${topUsersRes.error.message}`);

  type TopUser = { id: string; username: string; longest_streak: number };
  const topUsers: TopUser[] = topUsersRes.data ?? [];

  let logs: { user_id: string; activity_date: string; commit_count: number | null }[] = [];
  if (topUsers.length) {
    const logsRes = await sb
      .from("streak_logs")
      .select("user_id, activity_date, commit_count")
      .in("user_id", topUsers.map((u) => u.id))
      .gte("activity_date", cutoffIso);
    if (logsRes.error) throw new Error(`Failed to fetch proof wall logs: ${logsRes.error.message}`);
    logs = logsRes.data ?? [];
  }

  const perUser = new Map<string, Record<string, number>>();
  for (const log of logs) {
    const cells = perUser.get(log.user_id) ?? {};
    cells[log.activity_date] = Math.max(1, log.commit_count ?? 1);
    perUser.set(log.user_id, cells);
  }

  const days: string[] = [];
  for (let i = 0; i < PROOF_WALL_DAYS; i++) {
    const d = new Date(cutoff);
    d.setUTCDate(cutoff.getUTCDate() + i);
    days.push(d.toISOString().slice(0, 10));
  }

  const rows = topUsers.map((u) => ({
    username: u.username,
    cells: perUser.get(u.id) ?? {},
  }));

  // Trim leading days where NO selected row has activity, so the wall never
  // opens on a field of grey if the backfill has less history than the window.
  const firstActive = days.findIndex((d) => rows.some((r) => r.cells[d]));
  const visibleDays = firstActive > 0 ? days.slice(firstActive) : days;

  return {
    days: visibleDays,
    rows,
    totalBuilderDays: totalRes.count ?? 0,
    longestStreak: topUsers[0]?.longest_streak ?? 0,
    buildersTracked: buildersRes.count ?? 0,
  };
}

// 5 minutes: the wall is a marketing artifact, not a live feed — a wider
// window keeps the 70-day log scan (a few thousand rows) off the hot path.
// Key is versioned: an earlier build cached a wall built from a truncated
// 1000-row page, and that entry would otherwise keep serving a wall with
// weeks missing until its TTL expired. Bump the suffix whenever the shape of
// the returned data changes.
export const fetchProofWallCached = unstable_cache(_fetchProofWall, ["proof-wall-v3"], {
  revalidate: 300,
});

// ---------------------------------------------------------------------------
// Hero stats (the polled stat strip under the proof wall)
// ---------------------------------------------------------------------------

/**
 * The five figures the homepage stat strip renders. They already exist on the
 * SSR path, spread across `_fetchProofWall` (days / longest streak / builders)
 * and `_fetchHomepageData` (projects / avg streak). This gathers exactly the
 * same counts, with exactly the same filters, into one payload the client
 * poller can refresh from — if the filters here drift from the ones above, the
 * number a visitor lands on and the number they hold on would disagree.
 */
export interface HeroStats {
  totalBuilderDays: number;
  longestStreak: number;
  buildersTracked: number;
  totalProjects: number;
  avgStreak: number;
}

async function _fetchHeroStats(): Promise<HeroStats> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = getPublicClient() as any;

  const [daysRes, longestRes, buildersRes, projectsRes, streakRes] = await Promise.all([
    sb.from("streak_logs").select("*", { count: "exact", head: true }),
    sb
      .from("users")
      .select("longest_streak")
      .not("username", "is", null)
      .order("longest_streak", { ascending: false })
      .limit(1),
    sb.from("users").select("id", { count: "exact", head: true }).not("username", "is", null),
    sb.from("projects").select("id", { count: "exact", head: true }).eq("is_private", false),
    sb.from("users").select("streak").not("username", "is", null),
  ]);

  // Throw rather than return zeros: unstable_cache would hold a strip reading
  // "0 builders tracked" for the full TTL, and the client keeps its last good
  // numbers when the poll fails, which is the better failure. Every query
  // counts here — each one is a figure on the strip, so a transient failure in
  // any of them would otherwise be served as a confident zero.
  const failed = [daysRes, longestRes, buildersRes, projectsRes, streakRes]
    .map((res) => res.error?.message)
    .filter(Boolean);
  if (failed.length) {
    throw new Error(`Hero stats query failed: ${failed.join("; ")}`);
  }

  const streaks = (streakRes.data ?? []) as { streak: number }[];
  const avgStreak = streaks.length
    ? Math.round(streaks.reduce((acc, u) => acc + (u.streak || 0), 0) / streaks.length)
    : 0;

  return {
    totalBuilderDays: daysRes.count ?? 0,
    longestStreak: longestRes.data?.[0]?.longest_streak ?? 0,
    buildersTracked: buildersRes.count ?? 0,
    totalProjects: projectsRes.count ?? 0,
    avgStreak,
  };
}

// 30s. This backs a 60s client poll on the busiest page on the site, so the TTL
// is what keeps N concurrent visitors from becoming N x 5 Supabase queries.
export const fetchHeroStatsCached = unstable_cache(_fetchHeroStats, ["hero-stats-v1"], {
  revalidate: 30,
});
