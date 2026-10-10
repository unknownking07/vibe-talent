/**
 * Scoring tunables — centralized numeric constants for VibeTalent's scoring
 * logic so weights/thresholds are tuneable in one place rather than scattered
 * through formulas. Extracted from `streak.ts` and `agent-scoring.ts`.
 *
 * ⚠️ Changing any value here changes every user's score. Run
 *    `npm test -- scoring-baseline` to see if snapshots shift —
 *    any shift is a real scoring change and should be intentional.
 *
 * Streaks, badges and contribution volume are descriptive and earn no vibe-score points.
 */
import type { BadgeLevel } from "./types/database";

// ---- Vibe score (streak.ts) ----
export const VIBE_SCORE = {
  baseline: 10,
  perEndorsement: 5,
  reviewMultiplier: 2,
  reviewCap: 50,
} as const;

// ---- Badge tier thresholds (streak.ts getBadgeLevel) ----
export const BADGE_THRESHOLDS = {
  bronze: 30,
  silver: 90,
  gold: 180,
  diamond: 365,
} as const;

// ---- Agent evaluator (agent-scoring.ts evaluateUser) ----
export const AGENT_EVAL = {
  badgeBonuses: { none: 0, bronze: 10, silver: 20, gold: 35, diamond: 50 } as Record<BadgeLevel, number>,

  consistency: {
    streakWeight: 0.6,
    longestStreakWeight: 0.4,
    normalizer: 3.65,
    scale: 10,
  },

  // Inspectable signals on the strongest public, ownership-verified repo.
  // No credit for commit volume, popularity, project count, or endorsements.
  projectEvidence: {
    ownership: 40,
    readme: 15,
    testRelatedFiles: 15,
    ciOrContainerConfig: 10,
    reachableDemo: 20,
  },

  techBreadth: {
    perUniqueTech: 12,
  },

  activityRecency: {
    activeBase: 60,
    perStreakDay: 0.4,
    activeMaxBonus: 40,
    inactiveScore: 20,
  },

  reputation: {
    vibeScoreDivisor: 9,
    reviewMultiplier: 1.5,
    reviewCap: 25,
  },

  // Display/UI caps on extracted lists
  maxStrengths: 6,
  maxRisks: 5,
} as const;

// ---- Task-to-user matching (agent-scoring.ts matchUsers) ----
export const MATCH = {
  weights: {
    skill: 0.50,
    evaluation: 0.40,
    tag: 0.10,
  },
  defaultSkillScore: 50, // when task has no requested tech
  tagMatchScore: 80,
  tagNoMatchScore: 20,
  maxResults: 5,
  maxReasons: 4,
} as const;
