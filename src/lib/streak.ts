import type { BadgeLevel } from "@/lib/types/database";

/**
 * Calculate current streak from a sorted list of activity dates.
 * Dates must be in "YYYY-MM-DD" format, sorted ascending.
 */
export function calculateStreak(activityDates: string[]): {
  currentStreak: number;
  longestStreak: number;
} {
  if (activityDates.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  // Deduplicate and sort
  const uniqueDates = [...new Set(activityDates)].sort();

  let currentStreak = 1;
  let longestStreak = 1;
  let tempStreak = 1;

  for (let i = 1; i < uniqueDates.length; i++) {
    const prev = new Date(uniqueDates[i - 1]);
    const curr = new Date(uniqueDates[i]);
    const diffMs = curr.getTime() - prev.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffDays === 1) {
      tempStreak++;
    } else {
      tempStreak = 1;
    }

    longestStreak = Math.max(longestStreak, tempStreak);
  }

  // Check if current streak is active (last activity is today or yesterday)
  const lastDate = new Date(uniqueDates[uniqueDates.length - 1]);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  lastDate.setHours(0, 0, 0, 0);
  const daysSinceLast = (today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);

  if (daysSinceLast > 1) {
    currentStreak = 0;
  } else {
    // Walk backwards from the end to find current streak
    currentStreak = 1;
    for (let i = uniqueDates.length - 1; i > 0; i--) {
      const curr = new Date(uniqueDates[i]);
      const prev = new Date(uniqueDates[i - 1]);
      const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
      if (diff === 1) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  return { currentStreak, longestStreak: Math.max(longestStreak, currentStreak) };
}

/**
 * Calculate quality score for an individual project.
 * Verified projects earn bonus points for completeness (live URL, description, etc).
 * Max score per verified project: 15 pts.
 */
export function calculateProjectQualityScore(project: {
  verified?: boolean;
  live_url?: string | null;
  github_url?: string | null;
  description: string;
  image_url?: string | null;
  tech_stack: string[];
}): number {
  let score = project.verified ? 5 : 1;
  if (project.verified) {
    if (project.live_url) score += 3;
    if (project.github_url) score += 2;
    if (project.description.length > 50) score += 2;
    if (project.image_url) score += 1;
    if (project.tech_stack.length >= 3) score += 2;
  }
  return score;
}

/**
 * Calculate review bonus from client ratings.
 * Formula: avg_rating × review_count × 2, capped at 50.
 * This ensures quality builders with real client feedback get a meaningful boost.
 */
export function calculateReviewBonus(avgRating: number, reviewCount: number): number {
  if (reviewCount === 0) return 0;
  return Math.min(50, Math.round(avgRating * reviewCount * 2));
}

/**
 * Calculate vibe score based on streak, projects, badges, and reviews.
 * Formula: (Current Streak × 2) + Σ Project Quality Scores + Badge Bonus + Review Bonus
 *
 * Quality signals ensure that builders who ship polished, verified projects
 * with live demos and client reviews rank higher than pure streak grinders.
 */
export function calculateVibeScore(
  currentStreak: number,
  projectCount: number,
  badgeLevel: BadgeLevel,
  verifiedCount?: number,
  reviewBonus: number = 0
): number {
  const streakPoints = currentStreak * 2;

  // Verified projects get full 5 points, unverified only get 1 point
  const verified = verifiedCount ?? projectCount;
  const unverified = projectCount - verified;
  const projectPoints = verified * 5 + unverified * 1;

  const badgeBonusMap: Record<BadgeLevel, number> = {
    none: 0,
    bronze: 10,
    silver: 20,
    gold: 30,
    diamond: 40,
  };

  return streakPoints + projectPoints + badgeBonusMap[badgeLevel] + reviewBonus;
}

/**
 * Determine badge level from longest streak.
 */
export function getBadgeLevel(longestStreak: number): BadgeLevel {
  if (longestStreak >= 365) return "diamond";
  if (longestStreak >= 180) return "gold";
  if (longestStreak >= 90) return "silver";
  if (longestStreak >= 30) return "bronze";
  return "none";
}

/**
 * Get badge display info.
 */
export function getBadgeInfo(level: BadgeLevel) {
  const badges = {
    none: { label: "No Badge", color: "text-zinc-500", bg: "bg-zinc-800", icon: "○", requirement: "30 day streak" },
    bronze: { label: "Bronze", color: "text-amber-600", bg: "bg-amber-950", icon: "🥉", requirement: "30 day streak" },
    silver: { label: "Silver", color: "text-slate-300", bg: "bg-slate-800", icon: "🥈", requirement: "90 day streak" },
    gold: { label: "Gold", color: "text-yellow-400", bg: "bg-yellow-950", icon: "🥇", requirement: "180 day streak" },
    diamond: { label: "Diamond", color: "text-cyan-300", bg: "bg-cyan-950", icon: "💎", requirement: "365 day streak" },
  };
  return badges[level];
}
