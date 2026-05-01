import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { feedLimiter, checkRateLimit, getIP } from "@/lib/rate-limit";
import type { FeedItem, BadgeTier } from "@/components/feed/feed-types";

function getPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/** Mirrors `BADGE_THRESHOLD_DAYS_BY_TIER` in the schema's update_user_streak()
 *  function. Used for the feed copy ("earned Silver badge — 90-day streak"). */
const BADGE_THRESHOLD_DAYS: Record<BadgeTier, number> = {
  bronze: 30,
  silver: 90,
  gold: 180,
  diamond: 365,
};

/** Runtime guard for the `metadata->>'badge_level'` value pulled out of JSONB.
 *  The trigger only inserts non-`none` tiers, but the column type is `TEXT`
 *  so an unexpected value can't widen the API response by accident. */
const VALID_BADGE_TIERS: ReadonlySet<string> = new Set([
  "bronze",
  "silver",
  "gold",
  "diamond",
]);
function isBadgeTier(value: unknown): value is BadgeTier {
  return typeof value === "string" && VALID_BADGE_TIERS.has(value);
}

/** Cap each event-source query at this. We over-fetch a bit per source,
 *  merge them all, sort by date, and slice to the requested limit at the
 *  end — so the final feed is the freshest events globally, not just the
 *  freshest from each source individually. */
const PER_SOURCE_LIMIT = 50;

/** Trust threshold for surfacing reviews in the public feed. Matches the
 *  threshold the vibe-score logic uses (review_trust.ts) — anything below
 *  is treated as low-confidence/spam-adjacent and excluded from scoring,
 *  so it shouldn't pollute the feed either. */
const REVIEW_TRUST_THRESHOLD = 30;

/** Truncate review comments before they ship over the wire. Long screeds
 *  in the feed look weird; the profile page is the canonical place to
 *  read the full text. */
const REVIEW_COMMENT_MAX_LENGTH = 180;

function truncate(s: string | null, max: number): string | undefined {
  if (!s) return undefined;
  const trimmed = s.trim();
  if (!trimmed) return undefined;
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max - 1).trimEnd() + "…";
}

export async function GET(request: NextRequest) {
  const rawLimit = parseInt(request.nextUrl.searchParams.get("limit") || "100");
  const limit = Math.min(Math.max(isNaN(rawLimit) ? 100 : rawLimit, 1), 200);

  const { success } = await checkRateLimit(feedLimiter, getIP(request));
  if (!success) {
    return NextResponse.json({ feed: [], error: "Rate limited" }, { status: 429 });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = getPublicClient() as any;
    const feed: FeedItem[] = [];

    // Run every source query in parallel. We keep the soft-fail wrappers on
    // the optional ones (feed_events, notifications) so a single missing
    // table or RLS policy doesn't take down the whole feed — losing one
    // event type is degraded, losing all of them is broken.
    const [
      usersResult,
      eventsResult,
      streakResult,
      projectsResult,
      recentUsersResult,
      endorsementsResult,
      reviewsResult,
      badgeNotificationsResult,
    ] = await Promise.all([
      supabase
        .from("users")
        .select("id, username, display_name, avatar_url, badge_level, streak, github_username")
        .order("vibe_score", { ascending: false })
        .limit(200),
      supabase
        .from("feed_events")
        .select("id, event_type, repo_name, message, github_url, created_at, user_id")
        .order("created_at", { ascending: false })
        .limit(200)
        .then(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (r: any) => r,
          () => ({ data: null, error: "feed_events not available" })
        ),
      supabase
        .from("streak_logs")
        .select("id, activity_date, user_id")
        .order("activity_date", { ascending: false })
        .limit(100),
      supabase
        .from("projects")
        .select("id, title, description, tech_stack, live_url, github_url, created_at, user_id")
        .eq("flagged", false)
        .order("created_at", { ascending: false })
        .limit(30),
      supabase
        .from("users")
        .select("id, username, display_name, avatar_url, badge_level, streak, created_at, github_username")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("project_endorsements")
        .select("id, created_at, user_id, project_id, projects!inner(id, title, user_id, flagged)")
        .order("created_at", { ascending: false })
        .limit(PER_SOURCE_LIMIT)
        .then(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (r: any) => r,
          () => ({ data: null, error: "project_endorsements not available" })
        ),
      supabase
        .from("reviews")
        .select("id, created_at, builder_id, rating, comment, trust_score")
        .gte("trust_score", REVIEW_TRUST_THRESHOLD)
        .order("created_at", { ascending: false })
        .limit(PER_SOURCE_LIMIT)
        .then(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (r: any) => r,
          () => ({ data: null, error: "reviews not available" })
        ),
      supabase
        .from("notifications")
        .select("id, created_at, user_id, metadata")
        .eq("type", "badge_earned")
        .order("created_at", { ascending: false })
        .limit(PER_SOURCE_LIMIT)
        .then(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (r: any) => r,
          () => ({ data: null, error: "badge notifications not available" })
        ),
    ]);

    // Build user lookup map. Items whose user can't be resolved are dropped
    // rather than rendered as "unknown" — keeps the feed tidy.
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

    // 2. Streak logs (dedup against feed_events on (username, date))
    const coveredDates = new Set(
      feed.map(f => f.username + "|" + f.date.slice(0, 10))
    );
    for (const log of (streakResult.data || [])) {
      const user = userMap.get(log.user_id);
      if (!user) continue;
      const key = user.username + "|" + log.activity_date;
      if (coveredDates.has(key)) continue;
      coveredDates.add(key);
      // No `message` — the UI derives the label ("vibed") from `type === "streak"`.
      // Keeping this field empty avoids coupling the client-side grouping
      // sentinels to a specific user-visible string.
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

    // 5. Endorsements — surface them as "actor endorsed target's project".
    // Skip self-endorsements (anti-gaming covered at write time, but a
    // belt-and-braces filter keeps the feed clean even if a row sneaks in).
    if (endorsementsResult.data && !endorsementsResult.error) {
      for (const endorsement of endorsementsResult.data) {
        const actor = userMap.get(endorsement.user_id);
        // Supabase returns embedded relations as either an object or array
        // depending on the join cardinality — `projects!inner` is a single
        // row, but the type system surfaces it as a possibly-array. Normalize.
        const projectRow = Array.isArray(endorsement.projects)
          ? endorsement.projects[0]
          : endorsement.projects;
        if (!actor || !projectRow || projectRow.flagged) continue;
        if (endorsement.user_id === projectRow.user_id) continue; // self
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

    // 6. Reviews — actor in the feed line is the *recipient* (the builder
    // being reviewed), since reviewers are anonymous by name.
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

    // 7. Badge upgrades — sourced from the `notifications` table where
    // type='badge_earned' (visible to anon via the dedicated RLS policy
    // in 20260502_badge_events_public_read.sql). The trigger that creates
    // these rows stores the new tier in `metadata->>'badge_level'`.
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

    return NextResponse.json(
      { feed: feed.slice(0, limit) },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } }
    );
  } catch (err) {
    console.error("Feed API error:", err);
    return NextResponse.json({ feed: [], error: "Failed to load feed" });
  }
}
