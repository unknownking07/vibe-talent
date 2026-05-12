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
