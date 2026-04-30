/**
 * Scoring tunables — centralized numeric constants for VibeTalent's scoring
 * logic so weights/thresholds are tuneable in one place rather than scattered
 * through formulas. Extracted from `streak.ts` and `agent-scoring.ts`.
 *
 * ⚠️ Changing any value here changes every user's score. Run
 *    `npm test -- scoring-baseline` to see if snapshots shift —
 *    any shift is a real scoring change and should be intentional.
 *
 * Two "badge bonus" tables exist on purpose: the vibe-score badge bonuses
 * (streak.ts, integer-friendly) and the agent-eval badge bonuses
 * (agent-scoring.ts, 0–100 reputation scale) are tuned independently.
 */
import type { BadgeLevel } from "./types/database";

// ---- Vibe score (streak.ts) ----
export const VIBE_SCORE = {
  baseline: 10,
  perStreakDay: 2,
  verifiedProjectBase: 5,
  unverifiedProjectPoints: 1,
  qualityScoreDivisor: 10,
  qualityScoreCapPerProject: 10,
  perEndorsement: 5,
  reviewMultiplier: 2,
  reviewCap: 50,
  badgeBonuses: { none: 0, bronze: 10, silver: 20, gold: 30, diamond: 40 } as Record<BadgeLevel, number>,
  // Volume credit: rewards lifetime contribution count and recent activity
  // beyond just streak consistency. Values mirror the SQL migration
  // 20260430_add_volume_credit_to_vibe_score.sql so DB and TS stay in sync.
  volumeCredit: {
    // floor(log10(max(1, lifetime)) * lifetimeScale)
    // 100 commits → +8, 1k → +12, 10k → +16, 100k → +20
    lifetimeScale: 4,
    // min(floor(contributions_30d * recent30dWeight), recent30dCap)
    // 100 commits in last 30 days → +50 (capped)
    recent30dWeight: 0.5,
    recent30dCap: 50,
  },
} as const;

// ---- Per-project quality score (streak.ts calculateProjectScore) ----
export const PROJECT_SCORE = {
  unverifiedFlat: 1,
  verifiedBase: 5,
  liveUrlBonus: 3,
  githubBonus: 2,
  longDescBonus: 2,
  imageBonus: 1,
  techStackBonus: 2,
  longDescThreshold: 50,
  techStackThreshold: 3,
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

  // Quality-based project scoring (when quality_metrics is present)
  projectQuality: {
    avgWeight: 0.6,
    quantityBonusPerProject: 5,
    quantityBonusMax: 20,
    liveBonusPerProject: 5,
    liveBonusMax: 15,
    liveSiteOkPerProject: 5,
    unverifiedPointsPer: 1,
    endorsementBonusPer: 3,
    endorsementBonusMax: 15,
  },

  // Heuristic fallback (when no quality_metrics)
  projectQualityFallback: {
    verifiedPer: 15,
    unverifiedPer: 2,
    liveUrlPer: 10,
    githubPer: 5,
    longDescBonus: 10,
    longDescThreshold: 50,
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

  // Weights for combined overall_score (sum to 1.0)
  overallWeights: {
    projectQuality: 0.25,
    clientOutcomes: 0.20,
    consistency: 0.15,
    techBreadth: 0.15,
    activityRecency: 0.10,
    reputation: 0.15,
  },

  // Display/UI caps on extracted lists
  maxStrengths: 6,
  maxRisks: 5,
} as const;

// ---- Task-to-user matching (agent-scoring.ts matchUsers) ----
export const MATCH = {
  weights: {
    skill: 0.40,
    evaluation: 0.30,
    tag: 0.15,
    availability: 0.15,
  },
  defaultSkillScore: 50, // when task has no requested tech
  tagMatchScore: 80,
  tagNoMatchScore: 20,
  availability: {
    activeMultiplier: 2,
    activeCap: 100,
    inactiveScore: 10,
  },
  maxResults: 5,
  maxReasons: 4,
} as const;
