import { Bell, Flame, Trophy, CheckCircle, AlertTriangle, Mail, Star, Eye, BarChart3, Zap, LinkIcon, Users } from "lucide-react";

export const NOTIFICATION_ICONS: Record<string, typeof Bell> = {
  hire_request: Mail,
  streak_milestone: Flame,
  streak_warning: AlertTriangle,
  badge_earned: Trophy,
  project_verified: CheckCircle,
  project_flagged: AlertTriangle,
  new_review: Star,
  profile_view_summary: Eye,
  weekly_digest: BarChart3,
  vibe_score_milestone: Zap,
  project_missing_links: LinkIcon,
  referral_prompt: Users,
};

export const NOTIFICATION_COLORS: Record<string, string> = {
  hire_request: "#FF3A00",
  streak_milestone: "#F59E0B",
  streak_warning: "#EF4444",
  badge_earned: "#8B5CF6",
  project_verified: "#10B981",
  project_flagged: "#EF4444",
  new_review: "#F59E0B",
  profile_view_summary: "#3B82F6",
  weekly_digest: "#6366F1",
  vibe_score_milestone: "#FF3A00",
  project_missing_links: "#F59E0B",
  referral_prompt: "#FF3A00",
};

/**
 * Short, uppercase category label shown as a tag pill on each notification card.
 * Keep in sync with the `type` CHECK constraint in supabase/schema.sql.
 */
export const NOTIFICATION_TAGS: Record<string, string> = {
  hire_request: "Hire",
  streak_milestone: "Streak",
  streak_warning: "Warning",
  badge_earned: "Badge",
  project_verified: "Project",
  project_flagged: "Flagged",
  new_review: "Review",
  profile_view_summary: "Views",
  weekly_digest: "Digest",
  vibe_score_milestone: "Score",
  project_missing_links: "Project",
  referral_prompt: "Referral",
};

/**
 * Notification types that belong to the "Hires" filter tab. Everything not in
 * this set is treated as "Activity" — so new types automatically fall under
 * Activity without needing to be enumerated.
 */
export const HIRE_NOTIFICATION_TYPES = new Set<string>(["hire_request", "hire_message"]);

/**
 * Returns a safe URL extracted from a notification's metadata.link, or null if
 * the field is missing/unsafe. Defends against `javascript:`, `data:`,
 * `vbscript:`, protocol-relative (`//evil.com`), and backslash-trick URLs.
 *
 * Accepted shapes:
 *   - Same-origin paths starting with a single forward slash: "/dashboard"
 *   - Absolute http:// or https:// URLs
 *
 * Notification rows are written by server code today, but metadata is a
 * free-form jsonb column — any future write path (admin tool, migration,
 * compromised input) could land an unsafe value here, so we filter at the
 * render boundary rather than trust the producer.
 */
export function extractNotificationLink(
  metadata: Record<string, unknown> | null | undefined
): string | null {
  if (!metadata) return null;
  const link = metadata.link;
  if (typeof link !== "string" || link.length === 0) return null;
  // Same-origin relative path
  if (link.startsWith("/")) {
    if (link.startsWith("//") || link.includes("\\")) return null;
    return link;
  }
  // Absolute URL — only http(s) is allowed; rejects javascript:, data:, etc.
  try {
    const parsed = new URL(link);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return link;
  } catch {
    // unparseable
  }
  return null;
}

/**
 * Returns a safe avatar URL from a notification's metadata.avatar_url, or null
 * when absent/unsafe. Mirrors {@link extractNotificationLink}: metadata is a
 * free-form jsonb column, so we validate at the render boundary rather than
 * trust the producer. Accepts same-origin paths ("/avatars/x.jpg") and absolute
 * http(s) URLs; rejects javascript:/data:/protocol-relative/backslash tricks.
 *
 * People-driven notifications (a review, a hire request) can carry the actor's
 * photo here; system events have none and fall back to a type icon.
 */
export function extractNotificationAvatar(
  metadata: Record<string, unknown> | null | undefined
): string | null {
  if (!metadata) return null;
  const url = metadata.avatar_url;
  if (typeof url !== "string" || url.length === 0) return null;
  if (url.startsWith("/")) {
    if (url.startsWith("//") || url.includes("\\")) return null;
    return url;
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return url;
  } catch {
    // unparseable
  }
  return null;
}

export type NotificationBucket = "Today" | "This week" | "Earlier";

/** Buckets a notification by age for the grouped list: <24h, <7d, older. */
export function notificationBucket(dateStr: string): NotificationBucket {
  const timestamp = new Date(dateStr).getTime();
  if (Number.isNaN(timestamp)) return "Earlier";
  const diff = Date.now() - timestamp;
  if (diff < 86_400_000) return "Today";
  if (diff < 7 * 86_400_000) return "This week";
  return "Earlier";
}

export function notificationTimeAgo(dateStr: string): string {
  const timestamp = new Date(dateStr).getTime();
  if (Number.isNaN(timestamp)) return "";
  const diff = Date.now() - timestamp;
  if (diff < 0) return "just now"; // clock skew or future-dated row
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
