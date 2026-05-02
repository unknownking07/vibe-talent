/**
 * Server-side fetcher for the Live Network Feed (used by both the homepage
 * compact variant and the full `/feed` page).
 *
 * The existing `/api/feed` route does the same work for client-side polling,
 * but we deliberately don't reuse it via fetch from server components for
 * two reasons:
 *  1. Calling our own API route from a server component requires an absolute
 *     URL and adds an HTTP hop.
 *  2. The rest of the homepage already queries Supabase directly via
 *     `fetchHomepageDataCached` (see server-queries.ts), so this matches the
 *     existing convention — one cached server-side function per page section.
 *
 * Cache strategy: two `unstable_cache` entry points keyed separately so the
 * homepage's smaller dataset and the full /feed page's larger one don't
 * step on each other. Both share a 60s revalidate window and degrade
 * gracefully — if a single source query fails, the other event types still
 * render.
 *
 * Sparse-feed safeguard lives in the component layer, not here. This module
 * always returns whatever it found — the caller decides what's "enough."
 */

import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import type { FeedItem, BadgeTier } from "@/components/feed/feed-types";

/** Re-export under the legacy name so existing callers keep compiling.
 *  New code should import `FeedItem` from `@/components/feed/feed-types`. */
export type HomepageFeedItem = FeedItem;

/** Minimum item count to consider the feed "alive enough" to show. Below
 *  this, the homepage falls back to the small snippet — better to show a
 *  tight curated card than a sparse 3-item grid that reads as a ghost town. */
export const SPARSE_THRESHOLD = 8;

/** Hard cap on items rendered on the homepage. More than this and the feed
 *  dominates the page and pushes everything else below the fold. */
export const MAX_ITEMS = 12;

/** Hard cap on items rendered on the full /feed page. */
export const FULL_FEED_MAX_ITEMS = 100;

/** Mirrors the constants in `/api/feed/route.ts`. */
const BADGE_THRESHOLD_DAYS: Record<BadgeTier, number> = {
  bronze: 30,
  silver: 90,
  gold: 180,
  diamond: 365,
};
const VALID_BADGE_TIERS: ReadonlySet<string> = new Set([
  "bronze",
  "silver",
  "gold",
  "diamond",
]);
function isBadgeTier(value: unknown): value is BadgeTier {
  return typeof value === "string" && VALID_BADGE_TIERS.has(value);
}
const REVIEW_TRUST_THRESHOLD = 30;
const REVIEW_COMMENT_MAX_LENGTH = 180;

function truncate(s: string | null, max: number): string | undefined {
  if (!s) return undefined;
  const trimmed = s.trim();
  if (!trimmed) return undefined;
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max - 1).trimEnd() + "…";
}

function getPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

type FeedMode = "homepage" | "full";

/** Per-mode query limits. Keep these small — the merged feed is sliced
 *  back down to MAX_ITEMS / FULL_FEED_MAX_ITEMS at the end, so over-fetching
 *  is just network bytes and JSON-parse cost on the hot path.
 *
 *  Note: we no longer pre-fetch a `users` lookup table. Users are resolved
 *  by ID *after* the event sources land, so every event in the feed is
 *  guaranteed to be renderable regardless of the actor's vibe_score rank. */
const LIMITS_BY_MODE: Record<FeedMode, {
  events: number;
  streaks: number;
  projects: number;
  recent: number;
  endorsements: number;
  reviews: number;
  badges: number;
  outputCap: number;
}> = {
  homepage: {
    events: 60, streaks: 40, projects: 20, recent: 20,
    endorsements: 20, reviews: 20, badges: 20,
    outputCap: MAX_ITEMS,
  },
  full: {
    events: 80, streaks: 60, projects: 30, recent: 50,
    endorsements: 50, reviews: 50, badges: 50,
    outputCap: FULL_FEED_MAX_ITEMS,
  },
};

async function _fetchFeed(mode: FeedMode): Promise<FeedItem[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = getPublicClient() as any;
  const limits = LIMITS_BY_MODE[mode];

  // Phase 1: fetch every event source in parallel. Each optional source
  // (feed_events, endorsements, reviews, badge notifications) is wrapped
  // in a `.then(ok, err)` so a missing table or RLS gap on one event type
  // doesn't take down the whole feed.
  const [
    eventsResult,
    streakResult,
    projectsResult,
    recentUsersResult,
    endorsementsResult,
    reviewsResult,
    badgeNotificationsResult,
  ] = await Promise.all([
    sb.from("feed_events")
      .select("id, event_type, repo_name, message, github_url, created_at, user_id")
      .order("created_at", { ascending: false })
      .limit(limits.events)
      .then(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (r: any) => r,
        () => ({ data: null, error: "feed_events not available" })
      ),
    sb.from("streak_logs")
      .select("id, activity_date, user_id")
      .order("activity_date", { ascending: false })
      .limit(limits.streaks),
    sb.from("projects")
      .select("id, title, description, tech_stack, live_url, github_url, created_at, user_id")
      .eq("flagged", false)
      .order("created_at", { ascending: false })
      .limit(limits.projects),
    sb.from("users")
      .select("id, username, display_name, avatar_url, badge_level, streak, created_at, github_username")
      .order("created_at", { ascending: false })
      .limit(limits.recent),
    sb.from("project_endorsements")
      .select("id, created_at, user_id, project_id, projects!inner(id, title, user_id, flagged)")
      .order("created_at", { ascending: false })
      .limit(limits.endorsements)
      .then(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (r: any) => r,
        () => ({ data: null, error: "project_endorsements not available" })
      ),
    sb.from("reviews")
      .select("id, created_at, builder_id, rating, comment, trust_score")
      .gte("trust_score", REVIEW_TRUST_THRESHOLD)
      .order("created_at", { ascending: false })
      .limit(limits.reviews)
      .then(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (r: any) => r,
        () => ({ data: null, error: "reviews not available" })
      ),
    sb.from("notifications")
      .select("id, created_at, user_id, metadata")
      .eq("type", "badge_earned")
      .order("created_at", { ascending: false })
      .limit(limits.badges)
      .then(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (r: any) => r,
        () => ({ data: null, error: "badge notifications not available" })
      ),
  ]);

  // Phase 2: collect every user_id referenced by the event sources. We
  // used to fetch the top-N users by vibe_score and join client-side,
  // which silently dropped events from anyone outside that window —
  // exactly the lower-ranked builders the feed is supposed to surface.
  // Resolving users by ID guarantees every event in the response is
  // renderable.
  const referencedUserIds = new Set<string>();
  for (const e of (eventsResult.data || [])) referencedUserIds.add(e.user_id);
  for (const log of (streakResult.data || [])) referencedUserIds.add(log.user_id);
  for (const p of (projectsResult.data || [])) referencedUserIds.add(p.user_id);
  for (const e of (endorsementsResult.data || [])) {
    referencedUserIds.add(e.user_id);
    const projectRow = Array.isArray(e.projects) ? e.projects[0] : e.projects;
    if (projectRow?.user_id) referencedUserIds.add(projectRow.user_id);
  }
  for (const r of (reviewsResult.data || [])) referencedUserIds.add(r.builder_id);
  for (const n of (badgeNotificationsResult.data || [])) referencedUserIds.add(n.user_id);

  // Phase 3: resolve those IDs to user rows. Skip the round-trip entirely
  // when no events landed; otherwise issue one `id IN (...)` query that
  // scales with the actual feed size, not with the total user-base.
  const usersResult = referencedUserIds.size > 0
    ? await sb
        .from("users")
        .select("id, username, display_name, avatar_url, badge_level, streak, github_username")
        .in("id", [...referencedUserIds])
    : { data: [] };

  // Build user lookup map. Items whose user we can't resolve (deleted user,
  // RLS-hidden row, etc.) are dropped rather than rendered as "unknown" —
  // keeps the feed tidy.
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

  const feed: FeedItem[] = [];

  // 1. GitHub events
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

  // 2. Streak logs (dedup against feed_events)
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

  // 3. Projects
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

  // 4. Recent signups
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

  // 5. Endorsements
  if (endorsementsResult.data && !endorsementsResult.error) {
    for (const endorsement of endorsementsResult.data) {
      const actor = userMap.get(endorsement.user_id);
      const projectRow = Array.isArray(endorsement.projects)
        ? endorsement.projects[0]
        : endorsement.projects;
      if (!actor || !projectRow || projectRow.flagged) continue;
      if (endorsement.user_id === projectRow.user_id) continue;
      const owner = userMap.get(projectRow.user_id);
      if (!owner) continue;
      feed.push({
        id: `endorsement-${endorsement.id}`,
        type: "endorsement",
        username: actor.username,
        display_name: actor.display_name,
        avatar_url: actor.avatar_url,
        badge_level: actor.badge_level,
        streak: actor.streak,
        github_verified: actor.github_verified,
        date: endorsement.created_at,
        target_username: owner.username,
        target_display_name: owner.display_name,
        target_avatar_url: owner.avatar_url,
        project_title: projectRow.title,
      });
    }
  }

  // 6. Reviews — actor is the recipient (reviewer is anonymous by name).
  if (reviewsResult.data && !reviewsResult.error) {
    for (const review of reviewsResult.data) {
      const builder = userMap.get(review.builder_id);
      if (!builder) continue;
      feed.push({
        id: `review-${review.id}`,
        type: "review",
        username: builder.username,
        display_name: builder.display_name,
        avatar_url: builder.avatar_url,
        badge_level: builder.badge_level,
        streak: builder.streak,
        github_verified: builder.github_verified,
        date: review.created_at,
        rating: review.rating,
        review_comment: truncate(review.comment, REVIEW_COMMENT_MAX_LENGTH),
      });
    }
  }

  // 7. Badge upgrades (notifications table, exposed via dedicated RLS policy)
  if (badgeNotificationsResult.data && !badgeNotificationsResult.error) {
    for (const notification of badgeNotificationsResult.data) {
      const user = userMap.get(notification.user_id);
      if (!user) continue;
      const tierRaw = notification.metadata?.badge_level;
      if (!isBadgeTier(tierRaw)) continue;
      const tier: BadgeTier = tierRaw;
      feed.push({
        id: `badge-${notification.id}`,
        type: "badge",
        username: user.username,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        badge_level: user.badge_level,
        streak: user.streak,
        github_verified: user.github_verified,
        date: notification.created_at,
        badge_tier: tier,
        badge_threshold_days: BADGE_THRESHOLD_DAYS[tier],
      });
    }
  }

  feed.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return feed.slice(0, limits.outputCap);
}

/** Cached homepage feed (≤12 items). 60s revalidate window matches the rest
 *  of `fetchHomepageDataCached` so the whole homepage shares a coherent
 *  snapshot. The cache key is intentionally separate so a feed query failure
 *  cannot poison the topVibecoders / stats cache. */
export const fetchHomepageFeedCached = unstable_cache(
  () => _fetchFeed("homepage"),
  ["homepage-feed-v3"],
  { revalidate: 60 }
);

/** Cached full feed (≤100 items) for the dedicated `/feed` page.
 *  Same 60s window so client-side polling and SSR stay in sync. */
export const fetchFullFeedCached = unstable_cache(
  () => _fetchFeed("full"),
  ["full-feed-v1"],
  { revalidate: 60 }
);

/** Network velocity stats used by the right-rail card on the full feed.
 *  Mirrors the four numbers the existing /api/admin-stats route exposes
 *  (builders, projects, activeStreaks, endorsements) — the rest of that
 *  endpoint's payload (badges histogram, vibe-score averages, etc.) is
 *  not consumed by the feed UI, so we don't compute it here. */
export type FeedNetworkStats = {
  builders: number;
  projects: number;
  activeStreaks: number;
  endorsements: number;
};

async function _fetchFeedStats(): Promise<FeedNetworkStats> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = getPublicClient() as any;
  const [
    { count: builders },
    { count: projects },
    { count: activeStreaks },
    { count: endorsements },
  ] = await Promise.all([
    sb.from("users").select("id", { count: "exact", head: true }),
    sb.from("projects").select("id", { count: "exact", head: true }).eq("flagged", false),
    sb.from("users").select("id", { count: "exact", head: true }).gt("streak", 0),
    sb.from("project_endorsements").select("id", { count: "exact", head: true }),
  ]);
  return {
    builders: builders ?? 0,
    projects: projects ?? 0,
    activeStreaks: activeStreaks ?? 0,
    endorsements: endorsements ?? 0,
  };
}

/** Cached network stats. 60s revalidate matches the feed cache so a single
 *  page render sees a coherent snapshot. The four COUNT queries are head-
 *  only so they don't move row data over the wire. */
export const fetchFeedStatsCached = unstable_cache(
  _fetchFeedStats,
  ["feed-stats-v1"],
  { revalidate: 60 }
);
