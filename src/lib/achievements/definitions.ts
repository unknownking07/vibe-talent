/**
 * Achievement definitions for the profile achievements page.
 *
 * Each achievement is computed-on-read from existing user data — no
 * dedicated achievements_earned table. Progress is shown for tiered
 * achievements; binary ones are either earned or not.
 */

export type AchievementCategory =
  | "consistency"
  | "projects"
  | "community"
  | "career"
  | "contributor"
  | "identity";

export interface AchievementCounters {
  longestStreak: number;
  projectCount: number;
  verifiedProjectCount: number;
  topQualityScore: number;
  endorsementsReceived: number;
  hireRequestsReceived: number;
  completedHires: number;
  reviewsGiven: number;
  hasGithubLinked: boolean;
  referralCount: number;
  joinedAt: string | null;
}

export interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  category: AchievementCategory;
  threshold: number;
  unit: string;
  progress: (c: AchievementCounters) => number;
}

export interface AchievementState extends AchievementDefinition {
  current: number;
  earned: boolean;
  percent: number;
}

/**
 * Serializable projection of {@link AchievementState} — drops the
 * non-serializable `progress` function so the state can cross the
 * server → client component boundary (e.g. into the interactive
 * achievements view) without a React serialization error.
 */
export type AchievementView = Omit<AchievementState, "progress">;

export function toAchievementView(s: AchievementState): AchievementView {
  return {
    id: s.id,
    title: s.title,
    description: s.description,
    category: s.category,
    threshold: s.threshold,
    unit: s.unit,
    current: s.current,
    earned: s.earned,
    percent: s.percent,
  };
}

const FOUNDING_CUTOFF = "2026-01-01";

export const ACHIEVEMENTS: AchievementDefinition[] = [
  // CONSISTENCY — streak tiers
  {
    id: "streak_bronze",
    title: "Bronze Streak",
    description: "Log a 30-day coding streak.",
    category: "consistency",
    threshold: 30,
    unit: "days",
    progress: (c) => Math.min(c.longestStreak, 30),
  },
  {
    id: "streak_silver",
    title: "Silver Streak",
    description: "Log a 90-day coding streak.",
    category: "consistency",
    threshold: 90,
    unit: "days",
    progress: (c) => Math.min(c.longestStreak, 90),
  },
  {
    id: "streak_gold",
    title: "Gold Streak",
    description: "Log a 180-day coding streak.",
    category: "consistency",
    threshold: 180,
    unit: "days",
    progress: (c) => Math.min(c.longestStreak, 180),
  },
  {
    id: "streak_diamond",
    title: "Diamond Streak",
    description: "Log a full-year 365-day coding streak.",
    category: "consistency",
    threshold: 365,
    unit: "days",
    progress: (c) => Math.min(c.longestStreak, 365),
  },

  // PROJECTS — shipping tiers
  {
    id: "project_first",
    title: "First Ship",
    description: "Add your first project to your profile.",
    category: "projects",
    threshold: 1,
    unit: "projects",
    progress: (c) => Math.min(c.projectCount, 1),
  },
  {
    id: "project_builder",
    title: "Builder",
    description: "Ship 5 projects.",
    category: "projects",
    threshold: 5,
    unit: "projects",
    progress: (c) => Math.min(c.projectCount, 5),
  },
  {
    id: "project_prolific",
    title: "Prolific",
    description: "Ship 10 projects.",
    category: "projects",
    threshold: 10,
    unit: "projects",
    progress: (c) => Math.min(c.projectCount, 10),
  },
  {
    id: "project_verified",
    title: "Verified Builder",
    description: "Get one project verified via GitHub.",
    category: "projects",
    threshold: 1,
    unit: "verified",
    progress: (c) => Math.min(c.verifiedProjectCount, 1),
  },
  {
    id: "project_quality",
    title: "Quality Coder",
    description: "Ship a project with a quality score of 70 or higher.",
    category: "projects",
    threshold: 70,
    unit: "score",
    progress: (c) => Math.min(c.topQualityScore, 70),
  },

  // COMMUNITY — endorsement tiers
  {
    id: "endorse_first",
    title: "First Cheer",
    description: "Receive your first project endorsement.",
    category: "community",
    threshold: 1,
    unit: "endorsements",
    progress: (c) => Math.min(c.endorsementsReceived, 1),
  },
  {
    id: "endorse_liked",
    title: "Well-Liked",
    description: "Earn 10 endorsements across your projects.",
    category: "community",
    threshold: 10,
    unit: "endorsements",
    progress: (c) => Math.min(c.endorsementsReceived, 10),
  },
  {
    id: "endorse_crowd",
    title: "Crowd Favorite",
    description: "Earn 50 endorsements across your projects.",
    category: "community",
    threshold: 50,
    unit: "endorsements",
    progress: (c) => Math.min(c.endorsementsReceived, 50),
  },

  // CAREER — hire signal tiers
  {
    id: "hire_first",
    title: "In Demand",
    description: "Receive your first hire request from a recruiter or client.",
    category: "career",
    threshold: 1,
    unit: "requests",
    progress: (c) => Math.min(c.hireRequestsReceived, 1),
  },
  {
    id: "hire_hot",
    title: "Hot Hire",
    description: "Receive 5 hire requests.",
    category: "career",
    threshold: 5,
    unit: "requests",
    progress: (c) => Math.min(c.hireRequestsReceived, 5),
  },
  {
    id: "hire_sealed",
    title: "Sealed the Deal",
    description: "Complete your first hired gig.",
    category: "career",
    threshold: 1,
    unit: "completed",
    progress: (c) => Math.min(c.completedHires, 1),
  },

  // CONTRIBUTOR — review activity
  {
    id: "review_helpful",
    title: "Helpful Reviewer",
    description: "Submit 5 reviews on other builders' work.",
    category: "contributor",
    threshold: 5,
    unit: "reviews",
    progress: (c) => Math.min(c.reviewsGiven, 5),
  },
  {
    id: "review_pillar",
    title: "Community Pillar",
    description: "Submit 25 reviews on other builders' work.",
    category: "contributor",
    threshold: 25,
    unit: "reviews",
    progress: (c) => Math.min(c.reviewsGiven, 25),
  },

  // IDENTITY — profile setup & growth
  {
    id: "github_linked",
    title: "GitHub Linked",
    description: "Connect your GitHub account to your profile.",
    category: "identity",
    threshold: 1,
    unit: "linked",
    progress: (c) => (c.hasGithubLinked ? 1 : 0),
  },
  {
    id: "referral_first",
    title: "Word of Mouth",
    description: "Refer a friend who signs up to VibeTalent.",
    category: "identity",
    threshold: 1,
    unit: "referrals",
    progress: (c) => Math.min(c.referralCount, 1),
  },
  {
    id: "founding_member",
    title: "Founding Member",
    description: "Joined VibeTalent before 2026 — a true early adopter.",
    category: "identity",
    threshold: 1,
    unit: "joined",
    progress: (c) =>
      c.joinedAt && c.joinedAt < FOUNDING_CUTOFF ? 1 : 0,
  },
];

export const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  consistency: "Consistency",
  projects: "Projects",
  community: "Community",
  career: "Career",
  contributor: "Contributor",
  identity: "Identity",
};

export const CATEGORY_ORDER: AchievementCategory[] = [
  "consistency",
  "projects",
  "community",
  "career",
  "contributor",
  "identity",
];

export function computeAchievements(c: AchievementCounters): AchievementState[] {
  return ACHIEVEMENTS.map((def) => {
    const current = def.progress(c);
    const earned = current >= def.threshold;
    const rawPercent =
      def.threshold > 0 ? Math.round((current / def.threshold) * 100) : 0;
    const percent = Number.isFinite(rawPercent)
      ? Math.max(0, Math.min(100, rawPercent))
      : 0;
    return { ...def, current, earned, percent };
  });
}

export function groupByCategory(
  states: AchievementState[]
): Record<AchievementCategory, AchievementState[]> {
  const out = {} as Record<AchievementCategory, AchievementState[]>;
  for (const cat of CATEGORY_ORDER) out[cat] = [];
  for (const s of states) out[s.category].push(s);
  return out;
}
