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
 * Calculate vibe score based on streak and project quality.
 *
 * New formula uses actual GitHub quality scores instead of flat project count:
 *   (Current Streak × 2)
 * + (sum of per-project contribution based on quality_score)
 * + Badge Bonus
 *
 * Per-project contribution:
 *   - Verified with quality_score > 0: min(quality_score / 10, 10) points
 *   - Verified without quality_score: 5 points
 *   - Unverified: 1 point
 *
 * This means a single high-quality repo (score 80+) contributes 8-10 pts,
 * while 10 empty repos only contribute 10 pts total.
 */
export interface ProjectForScoring {
  verified: boolean;
  quality_score?: number;
  flagged?: boolean;
}

export function calculateVibeScore(
  currentStreak: number,
  projectCount: number,
  badgeLevel: BadgeLevel,
  verifiedCount?: number,
  projects?: ProjectForScoring[]
): number {
  const streakPoints = currentStreak * 2;

  let projectPoints: number;
  if (projects && projects.length > 0) {
    // New quality-based scoring
    projectPoints = projects
      .filter((p) => !p.flagged)
      .reduce((sum, p) => {
        if (p.verified && p.quality_score && p.quality_score > 0) {
          return sum + Math.min(Math.floor(p.quality_score / 10), 10);
        } else if (p.verified) {
          return sum + 5;
        }
        return sum + 1;
      }, 0);
  } else {
    // Fallback for callers without full project data
    const verified = verifiedCount ?? projectCount;
    const unverified = projectCount - verified;
    projectPoints = verified * 5 + unverified * 1;
  }

  const badgeBonusMap: Record<BadgeLevel, number> = {
    none: 0,
    bronze: 10,
    silver: 20,
    gold: 30,
    diamond: 40,
  };

  return streakPoints + projectPoints + badgeBonusMap[badgeLevel];
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
