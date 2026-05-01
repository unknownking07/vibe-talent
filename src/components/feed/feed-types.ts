/**
 * Shared types for the Live Network Feed.
 *
 * Single source of truth — `/api/feed/route.ts`, `lib/homepage-feed.ts`,
 * and the `<NetworkFeed>` / `<FeedRow>` components all import from here.
 * Previously the same shape was duplicated in three places, which is how
 * the original 7-type union drifted (one file added "create"/"issue" while
 * the cached homepage path stayed on the older union).
 */

/** Every kind of activity surfaced in the feed. New types should be added
 *  here first, then plumbed through the API → renderer in that order so
 *  TypeScript catches any mismatch. */
export type FeedItemType =
  // GitHub activity (synced to feed_events by the cron worker)
  | "push"
  | "pr"
  | "create"
  | "issue"
  // In-app activity
  | "project"      // user shipped a project
  | "streak"       // user logged a daily activity (milestone treatment >= 30d)
  | "joined"       // new builder
  | "endorsement"  // user 👍'd someone else's project
  | "review"       // builder received a star-rating review
  | "badge";       // user upgraded to a new tier (bronze → silver → gold → diamond)

/** Tier identifier used for badge events and avatar accent treatment. */
export type BadgeTier = "bronze" | "silver" | "gold" | "diamond";

export type FeedItem = {
  id: string;
  type: FeedItemType;

  /** The actor — the person whose action produced the event. For review
   *  events specifically, this is the *recipient* (reviewers are anonymous
   *  by name, so the feed line reads as "@user received a 5★ review"). */
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  badge_level: string;
  streak: number;
  github_verified: boolean;

  /** ISO-8601 timestamp; sort key. */
  date: string;

  // GitHub-event fields
  repo_name?: string;
  message?: string;
  github_url?: string;

  // Project-event fields
  project_title?: string;
  project_description?: string;
  tech_stack?: string[];
  live_url?: string;

  // Endorsement / review-event fields — describe the *target* of the action.
  target_username?: string;
  target_display_name?: string | null;
  target_avatar_url?: string | null;

  // Review-event fields
  rating?: number;             // 1–5
  review_comment?: string;     // truncated server-side

  // Badge-event fields
  badge_tier?: BadgeTier;
  badge_threshold_days?: number; // 30 / 90 / 180 / 365 — kept for copy
};

/** Filter chip values shown above the feed. `"all"` means no filter applied;
 *  `"push"` collapses both `push` and `create` GitHub events into one chip
 *  ("Commits") because users don't think of branch creation as distinct. */
export type FeedFilter =
  | "all"
  | "project"
  | "push"
  | "pr"
  | "review"
  | "endorsement"
  | "badge"
  | "streak"
  | "joined";

/** Display labels for the filter chips. Order here is the order they render. */
export const FILTER_LABELS: Record<FeedFilter, string> = {
  all: "All Activity",
  project: "Ships",
  push: "Commits",
  pr: "PRs Merged",
  review: "Reviews",
  endorsement: "Endorsements",
  badge: "Badges",
  streak: "Streaks",
  joined: "New Builders",
};

/** Items grouped client-side for compact rendering — multiple commits to the
 *  same repo within a 4-hour window collapse into one row. Only push/pr/
 *  create/issue events group; achievements (project, review, etc.) always
 *  render as standalone rows so a single ship doesn't get hidden inside
 *  a noisy commit cluster. */
export type GroupedFeedItem = FeedItem & {
  count: number;
  messages: string[];
};

/** Live network stats shown in the right sidebar of the full feed view. */
export type LiveStats = {
  builders: number;
  projects: number;
  activeStreaks: number;
  endorsements: number;
} | null;

/** 4 hours in ms — the grouping window for repeated GitHub events. */
export const GROUP_WINDOW = 4 * 60 * 60 * 1000;

/** Types that should never group with siblings — each one stands on its own
 *  row regardless of how close they are in time. */
const STANDALONE_TYPES: ReadonlySet<FeedItemType> = new Set<FeedItemType>([
  "project",
  "joined",
  "review",
  "endorsement",
  "badge",
]);

export function isStandaloneType(t: FeedItemType): boolean {
  return STANDALONE_TYPES.has(t);
}
