/**
 * Server-side fetcher for the homepage's live activity feed.
 *
 * The existing `/api/feed` route already does this work for the client-side
 * `LiveActivityFeed` component, but we deliberately don't reuse it via fetch
 * here for two reasons:
 *  1. Calling our own API route from a server component requires an absolute
 *     URL and adds an HTTP hop.
 *  2. The rest of the homepage already queries Supabase directly via
 *     `fetchHomepageDataCached` (see server-queries.ts), so this matches the
 *     existing convention — one cached server-side function per page section.
 *
 * Cache strategy: `unstable_cache` with a 60s revalidate window, keyed
 * separately from the existing `homepage-data` cache so a feed-query failure
 * doesn't poison the rest of the homepage.
 *
 * Sparse-feed safeguard lives in the component layer, not here. This module
 * always returns whatever it found — the caller decides what's "enough."
 */

import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";

export type HomepageFeedItem = {
  id: string;
  type: "push" | "pr" | "create" | "issue" | "project" | "streak" | "joined";
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  badge_level: string;
  streak: number;
  github_verified: boolean;
  date: string;
  repo_name?: string;
  message?: string;
  github_url?: string;
  project_title?: string;
  project_description?: string;
  tech_stack?: string[];
  live_url?: string;
};

/** Minimum item count to consider the feed "alive enough" to show. Below
 *  this, the homepage falls back to the small snippet — better to show a
 *  tight curated card than a sparse 3-item grid that reads as a ghost town. */
export const SPARSE_THRESHOLD = 8;

/** Hard cap on items rendered. More than this and the feed dominates the
 *  homepage and pushes everything else below the fold. */
export const MAX_ITEMS = 12;

function getPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

async function _fetchHomepageFeed(): Promise<HomepageFeedItem[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = getPublicClient() as any;

  // Mirror the parallel-query pattern in /api/feed/route.ts but with smaller
  // limits — we only need enough raw rows to fill MAX_ITEMS after dedup.
  const [usersResult, eventsResult, streakResult, projectsResult, recentUsersResult] = await Promise.all([
    sb.from("users")
      .select("id, username, display_name, avatar_url, badge_level, streak, github_username")
      .order("vibe_score", { ascending: false })
      .limit(200),
    sb.from("feed_events")
      .select("id, event_type, repo_name, message, github_url, created_at, user_id")
      .order("created_at", { ascending: false })
      .limit(60)
      .then(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (r: any) => r,
        () => ({ data: null, error: "feed_events not available" })
      ),
    sb.from("streak_logs")
      .select("id, activity_date, user_id")
      .order("activity_date", { ascending: false })
      .limit(40),
    sb.from("projects")
      .select("id, title, description, tech_stack, live_url, github_url, created_at, user_id")
      .eq("flagged", false)
      .order("created_at", { ascending: false })
      .limit(20),
    sb.from("users")
      .select("id, username, display_name, avatar_url, badge_level, streak, created_at, github_username")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  // Build user lookup map. We only enrich items whose user we can resolve —
  // anything orphaned gets dropped to avoid showing dangling activity.
  const userMap = new Map<string, {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    badge_level: string;
    streak: number;
    github_verified: boolean;
  }>();
  for (const u of (usersResult.data || [])) {
    userMap.set(u.id, {
      username: u.username,
      display_name: u.display_name || null,
      avatar_url: u.avatar_url,
      badge_level: u.badge_level || "none",
      streak: u.streak || 0,
      github_verified: Boolean(u.github_username),
    });
  }

  const feed: HomepageFeedItem[] = [];

  // 1. GitHub events. The .then(r=>r, ...) above swallows the error if the
  // table doesn't exist on this environment — handle that silently.
  if (eventsResult.data && !eventsResult.error) {
    for (const event of eventsResult.data) {
      const user = userMap.get(event.user_id);
      if (!user) continue;
      feed.push({
        id: `event-${event.id}`,
        type: event.event_type || "push",
        username: user.username,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        badge_level: user.badge_level,
        streak: user.streak,
        github_verified: user.github_verified,
        date: event.created_at,
        repo_name: event.repo_name,
        message: event.message,
        github_url: event.github_url,
      });
    }
  }

  // 2. Streak logs — dedup against feed_events on (username, date) so we
  // don't show "vibed" right next to "pushed 3 commits" for the same day.
  const coveredDates = new Set(
    feed.map((f) => `${f.username}|${f.date.slice(0, 10)}`)
  );
  for (const log of (streakResult.data || [])) {
    const user = userMap.get(log.user_id);
    if (!user) continue;
    const key = `${user.username}|${log.activity_date}`;
    if (coveredDates.has(key)) continue;
    coveredDates.add(key);
    feed.push({
      id: `streak-${log.id}`,
      type: "streak",
      username: user.username,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
      badge_level: user.badge_level,
      streak: user.streak,
      github_verified: user.github_verified,
      date: log.activity_date,
    });
  }

  // 3. Projects (the most marketing-relevant card type — they show actual
  // shipped work).
  for (const project of (projectsResult.data || [])) {
    const user = userMap.get(project.user_id);
    if (!user) continue;
    feed.push({
      id: `project-${project.id}`,
      type: "project",
      username: user.username,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
      badge_level: user.badge_level,
      streak: user.streak,
      github_verified: user.github_verified,
      date: project.created_at,
      project_title: project.title,
      project_description: project.description,
      tech_stack: project.tech_stack || [],
      live_url: project.live_url || undefined,
      github_url: project.github_url || undefined,
    });
  }

  // 4. Recent signups — use sparingly, but a "X just joined" line is a
  // strong activity signal for an empty-feeling marketplace.
  for (const user of (recentUsersResult.data || [])) {
    feed.push({
      id: `joined-${user.id}`,
      type: "joined",
      username: user.username,
      display_name: user.display_name || null,
      avatar_url: user.avatar_url,
      badge_level: user.badge_level || "none",
      streak: user.streak || 0,
      github_verified: Boolean(user.github_username),
      date: user.created_at,
      message: "joined VibeTalent",
    });
  }

  feed.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return feed.slice(0, MAX_ITEMS);
}

/** ISR-friendly cached entry point. Mirrors the 60-second window used by the
 *  rest of `fetchHomepageDataCached` so the whole homepage shares a coherent
 *  snapshot. The cache key is intentionally separate so a feed query failure
 *  cannot poison the topVibecoders / stats cache. */
export const fetchHomepageFeedCached = unstable_cache(
  _fetchHomepageFeed,
  ["homepage-feed-v2"],
  { revalidate: 60 }
);
