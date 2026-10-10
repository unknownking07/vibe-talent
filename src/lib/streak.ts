import { projectEvidenceScore, type ProjectEvidenceInput } from "./project-evidence";
import type { BadgeLevel } from "@/lib/types/database";
import { VIBE_SCORE, BADGE_THRESHOLDS } from "@/lib/scoring-config";

/** Legacy metadata is accepted for callers, but only verified evidence earns credit. */
export interface ProjectScoreInput extends ProjectEvidenceInput {
  github_url?: string | null;
  description?: string;
  image_url?: string | null;
  tech_stack?: string[];
}

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

/** Same evidence rules as hiring and the database; no activity-derived quality score. */
export function calculateProjectScore(project: ProjectScoreInput): number {
  return projectEvidenceScore(project);
}

/**
 * Calculate review bonus from client ratings.
 * Formula: avg_rating × review_count × 2, capped at 50.
 * This ensures quality builders with real client feedback get a meaningful boost.
 */
export function calculateReviewBonus(avgRating: number, reviewCount: number): number {
  if (reviewCount === 0) return 0;
  return Math.min(VIBE_SCORE.reviewCap, Math.round(avgRating * reviewCount * VIBE_SCORE.reviewMultiplier));
}

/** Activity arguments remain for compatibility and deliberately earn zero points.
 * Count-only inputs cannot establish verified evidence, so they earn zero points.
 * Reputation uses the strongest public verified project, plus community feedback.
 * The authoritative database additionally includes its existing vouch credit.
 */
export interface ProjectForScoring extends ProjectEvidenceInput {
  quality_score?: number;
}

export function calculateVibeScore(
  _currentStreak: number,
  projectCountOrProjects: number | ProjectScoreInput[],
  _badgeLevel: BadgeLevel,
  _verifiedCount?: number,
  projects?: ProjectForScoring[],
  reviewBonus: number = 0,
  endorsementCount: number = 0,
  _lifetimeContributions: number = 0,
  _contributions30d: number = 0
): number {
  void _lifetimeContributions;
  void _contributions30d;
  const evidence = projects ?? (Array.isArray(projectCountOrProjects) ? projectCountOrProjects : []);
  const projectPoints = evidence.reduce((best, project) => Math.max(best, projectEvidenceScore(project)), 0);
  return VIBE_SCORE.baseline + projectPoints + reviewBonus + endorsementCount * VIBE_SCORE.perEndorsement;
}

/**
 * Determine badge level from longest streak.
 */
export function getBadgeLevel(longestStreak: number): BadgeLevel {
  if (longestStreak >= BADGE_THRESHOLDS.diamond) return "diamond";
  if (longestStreak >= BADGE_THRESHOLDS.gold) return "gold";
  if (longestStreak >= BADGE_THRESHOLDS.silver) return "silver";
  if (longestStreak >= BADGE_THRESHOLDS.bronze) return "bronze";
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
