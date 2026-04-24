import type { BadgeLevel } from "@/lib/types/database";
import { VIBE_SCORE, PROJECT_SCORE, BADGE_THRESHOLDS } from "@/lib/scoring-config";

/** Minimal project shape needed for quality scoring. */
export interface ProjectScoreInput {
  verified: boolean;
  live_url: string | null;
  github_url: string | null;
  description: string;
  image_url: string | null;
  tech_stack: string[];
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

/**
 * Score a single project based on quality signals.
 * Verified projects earn bonus points for completeness;
 * unverified projects get a flat 1 point.
 *
 * Breakdown (verified only):
 *   Base:              5 pts
 *   Live URL:         +3 pts
 *   GitHub URL:       +2 pts
 *   Description >50c: +2 pts
 *   Screenshot/image: +1 pt
 *   Tech stack >=3:    +2 pts
 *   Max per project:  15 pts
 */
export function calculateProjectScore(project: ProjectScoreInput): number {
  if (!project.verified) return PROJECT_SCORE.unverifiedFlat;

  let score = PROJECT_SCORE.verifiedBase;
  if (project.live_url) score += PROJECT_SCORE.liveUrlBonus;
  if (project.github_url) score += PROJECT_SCORE.githubBonus;
  if (project.description && project.description.length > PROJECT_SCORE.longDescThreshold) {
    score += PROJECT_SCORE.longDescBonus;
  }
  if (project.image_url) score += PROJECT_SCORE.imageBonus;
  if (project.tech_stack && project.tech_stack.length >= PROJECT_SCORE.techStackThreshold) {
    score += PROJECT_SCORE.techStackBonus;
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
  return Math.min(VIBE_SCORE.reviewCap, Math.round(avgRating * reviewCount * VIBE_SCORE.reviewMultiplier));
}

/**
 * Calculate vibe score based on streak, projects, badges, reviews, and quality scores.
 *
 * New formula uses actual GitHub quality scores instead of flat project count:
 *   (Current Streak x 2)
 * + (sum of per-project contribution based on quality_score)
 * + Badge Bonus
 * + Review Bonus
 *
 * Per-project contribution (when ProjectForScoring[] is provided):
 *   - Verified with quality_score > 0: min(quality_score / 10, 10) points
 *   - Verified without quality_score: 5 points
 *   - Unverified: 1 point
 *
 * Accepts either detailed project list (preferred) or legacy count-based params.
 */
export interface ProjectForScoring {
  verified: boolean;
  quality_score?: number;
  flagged?: boolean;
}

export function calculateVibeScore(
  currentStreak: number,
  projectCountOrProjects: number | ProjectScoreInput[],
  badgeLevel: BadgeLevel,
  verifiedCount?: number,
  projects?: ProjectForScoring[],
  reviewBonus: number = 0,
  endorsementCount: number = 0
): number {
  const baseline = VIBE_SCORE.baseline;
  const streakPoints = currentStreak * VIBE_SCORE.perStreakDay;

  let projectPoints: number;
  if (projects && projects.length > 0) {
    // New quality-based scoring using GitHub quality scores
    projectPoints = projects
      .filter((p) => !p.flagged)
      .reduce((sum, p) => {
        if (p.verified && p.quality_score && p.quality_score > 0) {
          return sum + Math.min(
            Math.floor(p.quality_score / VIBE_SCORE.qualityScoreDivisor),
            VIBE_SCORE.qualityScoreCapPerProject
          );
        } else if (p.verified) {
          return sum + VIBE_SCORE.verifiedProjectBase;
        }
        return sum + VIBE_SCORE.unverifiedProjectPoints;
      }, 0);
  } else if (Array.isArray(projectCountOrProjects)) {
    // Score each project individually using ProjectScoreInput
    projectPoints = projectCountOrProjects.reduce(
      (sum, p) => sum + calculateProjectScore(p),
      0
    );
  } else {
    // Legacy path: flat scoring for backward compatibility
    const verified = verifiedCount ?? projectCountOrProjects;
    const unverified = projectCountOrProjects - verified;
    projectPoints = verified * VIBE_SCORE.verifiedProjectBase + unverified * VIBE_SCORE.unverifiedProjectPoints;
  }

  const endorsementPoints = endorsementCount * VIBE_SCORE.perEndorsement;

  return baseline + streakPoints + projectPoints + VIBE_SCORE.badgeBonuses[badgeLevel] + reviewBonus + endorsementPoints;
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
