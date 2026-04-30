/**
 * Baseline / snapshot tests for scoring logic.
 *
 * Purpose: lock current numeric outputs of evaluateUser/matchUsers and
 * calculateVibeScore/calculateProjectScore/calculateReviewBonus so that
 * extracting scoring magic numbers into a SCORING config CANNOT silently
 * drift any user's score. If any output here changes, the refactor is
 * wrong — investigate immediately.
 *
 * These are intentionally narrow (just numbers + short flags), not full
 * object snapshots, because evaluated_at is time-sensitive and summary
 * text is generated from string templates we aren't refactoring.
 */
import { describe, it, expect } from "vitest";
import { evaluateUser, matchUsers } from "../agent-scoring";
import {
  calculateVibeScore,
  calculateProjectScore,
  calculateReviewBonus,
  getBadgeLevel,
} from "../streak";
import type { UserWithSocials, Project } from "../types/database";
import type { TaskRequest } from "../types/agent";

const projectDefaults: Pick<Project, "quality_score" | "quality_metrics" | "live_url_ok" | "endorsement_count"> = {
  quality_score: 0,
  quality_metrics: null,
  live_url_ok: null,
  endorsement_count: 0,
};

function mkProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "p-1",
    user_id: "u-1",
    title: "Project",
    description: "A comprehensive test project description with many features and good documentation",
    tech_stack: ["React", "TypeScript", "Node.js"],
    live_url: "https://example.com",
    github_url: "https://github.com/x/y",
    image_url: null,
    build_time: null,
    tags: [],
    verified: true,
    created_at: "2025-01-01T00:00:00Z",
    ...projectDefaults,
    ...overrides,
  };
}

function mkUser(overrides: Partial<UserWithSocials> = {}): UserWithSocials {
  return {
    id: "u-1",
    username: "alice",
    display_name: null,
    bio: null,
    avatar_url: null,
    github_username: null,
    streak: 10,
    longest_streak: 20,
    vibe_score: 50,
    badge_level: "none",
    streak_freezes_remaining: 0,
    streak_freezes_used: 0,
    referral_count: 0,
    created_at: "2025-01-01T00:00:00Z",
    social_links: null,
    projects: [],
    ...overrides,
  };
}

// ---- Personas: representative across the scoring space ----

const beginner = mkUser({
  username: "beginner",
  streak: 5,
  longest_streak: 10,
  vibe_score: 30,
  badge_level: "none",
  projects: [mkProject({ verified: false, description: "short" })],
});

const shipperBronze = mkUser({
  username: "shipper",
  streak: 45,
  longest_streak: 60,
  vibe_score: 250,
  badge_level: "bronze",
  projects: [mkProject(), mkProject({ id: "p-2" }), mkProject({ id: "p-3" })],
});

const highScoreGold = mkUser({
  username: "highscore",
  streak: 200,
  longest_streak: 200,
  vibe_score: 650,
  badge_level: "gold",
  projects: [
    mkProject({ quality_score: 80, quality_metrics: { has_tests: true, has_ci: true } as unknown as Project["quality_metrics"], live_url_ok: true, endorsement_count: 3 }),
    mkProject({ id: "p-2", quality_score: 70, live_url_ok: true, endorsement_count: 2 }),
    mkProject({ id: "p-3", quality_score: 60 }),
  ],
});

const zeroStreakInactive = mkUser({
  username: "inactive",
  streak: 0,
  longest_streak: 45,
  vibe_score: 150,
  badge_level: "bronze",
  projects: [mkProject({ verified: false })],
});

const diamondBadge = mkUser({
  username: "diamond",
  streak: 400,
  longest_streak: 400,
  vibe_score: 900,
  badge_level: "diamond",
  projects: [
    mkProject({ quality_score: 90, live_url_ok: true, endorsement_count: 5 }),
    mkProject({ id: "p-2", quality_score: 85, live_url_ok: true, endorsement_count: 4 }),
    mkProject({ id: "p-3", quality_score: 75, live_url_ok: true, endorsement_count: 2 }),
    mkProject({ id: "p-4", quality_score: 70 }),
  ],
});

// Extract just the numeric, deterministic parts
function snap(user: UserWithSocials) {
  const r = evaluateUser(user);
  return {
    username: r.username,
    overall_score: r.overall_score,
    dimensions: r.dimensions,
    badge_level: r.badge_level,
    strengths_count: r.strengths.length,
    risks_count: r.risks.length,
  };
}

// ---- evaluateUser baseline locks ----

describe("evaluateUser numeric baseline (locks before refactor)", () => {
  it("beginner persona — low streak, 1 unverified project", () => {
    expect(snap(beginner)).toMatchSnapshot();
  });

  it("shipper persona — bronze badge, 3 verified projects", () => {
    expect(snap(shipperBronze)).toMatchSnapshot();
  });

  it("high-score gold persona — long streak + quality metrics", () => {
    expect(snap(highScoreGold)).toMatchSnapshot();
  });

  it("inactive persona — zero current streak but past activity", () => {
    expect(snap(zeroStreakInactive)).toMatchSnapshot();
  });

  it("diamond persona — top-tier across all dimensions", () => {
    expect(snap(diamondBadge)).toMatchSnapshot();
  });
});

// ---- matchUsers baseline locks ----

describe("matchUsers numeric baseline", () => {
  const task: TaskRequest = {
    description: "Build a SaaS dashboard with React and TypeScript",
    project_type: "mvp",
    tech_stack: ["React", "TypeScript"],
    budget: "2k_5k",
    timeline: "1_month",
  };

  it("orders and scores across 5 personas deterministically", () => {
    const results = matchUsers(
      [beginner, shipperBronze, highScoreGold, zeroStreakInactive, diamondBadge],
      task
    );
    const shape = results.map((r) => ({
      username: r.user.username,
      match_score: r.match_score,
      matched_skills: r.matched_skills,
      reasons_count: r.match_reasons.length,
      recommended_for: r.recommended_for,
    }));
    expect(shape).toMatchSnapshot();
  });
});

// ---- streak.ts calculateVibeScore baseline ----

describe("calculateVibeScore numeric baseline", () => {
  it("beginner — 5 streak, 1 unverified, no badge", () => {
    expect(
      calculateVibeScore(5, 1, "none", 0, [
        { verified: false },
      ])
    ).toMatchSnapshot();
  });

  it("shipper — 45 streak, 3 verified projects, bronze", () => {
    expect(
      calculateVibeScore(45, 3, "bronze", 3, [
        { verified: true, quality_score: 0 },
        { verified: true, quality_score: 0 },
        { verified: true, quality_score: 0 },
      ])
    ).toMatchSnapshot();
  });

  it("high-score — 200 streak, 3 projects with quality scores, gold", () => {
    expect(
      calculateVibeScore(200, 3, "gold", 3, [
        { verified: true, quality_score: 80 },
        { verified: true, quality_score: 70 },
        { verified: true, quality_score: 60 },
      ])
    ).toMatchSnapshot();
  });

  it("diamond with endorsements + review bonus", () => {
    expect(
      calculateVibeScore(
        400,
        4,
        "diamond",
        4,
        [
          { verified: true, quality_score: 90 },
          { verified: true, quality_score: 85 },
          { verified: true, quality_score: 75 },
          { verified: true, quality_score: 70 },
        ],
        30, // reviewBonus
        8  // endorsementCount
      )
    ).toMatchSnapshot();
  });

  it("legacy path — count-based scoring, no project detail", () => {
    expect(calculateVibeScore(30, 5, "bronze", 3)).toMatchSnapshot();
  });

  it("flagged project contributes zero", () => {
    expect(
      calculateVibeScore(10, 2, "none", 2, [
        { verified: true, quality_score: 50, flagged: true },
        { verified: true, quality_score: 50 },
      ])
    ).toMatchSnapshot();
  });

  // Volume credit (lifetime + recent 30d) — locks the additive bonus so a
  // future tweak to lifetimeScale or recent30dWeight is caught immediately.
  // Default callers (no volume args) hit the snapshots above unchanged.
  it("volume credit: 16k lifetime, 0 recent — addresses Meta's 16k-commit case", () => {
    // 0 streak + 0 projects + no badge + 16k lifetime + 0 recent
    // = 10 + 0 + 0 + 0 + floor(log10(16000)*4) + 0 = 10 + 16 = 26
    expect(
      calculateVibeScore(0, 0, "none", undefined, undefined, 0, 0, 16000, 0)
    ).toMatchSnapshot();
  });

  it("volume credit: active veteran — 50k lifetime, 100 last-30d, gold badge", () => {
    // 30 streak + 3 quality projects + gold + 50k lifetime + 100 30d
    // = 10 + 60 + 21 + 30 + floor(log10(50000)*4) + min(50, 50) = 10+60+21+30+18+50 = 189
    expect(
      calculateVibeScore(
        30,
        3,
        "gold",
        3,
        [
          { verified: true, quality_score: 80 },
          { verified: true, quality_score: 70 },
          { verified: true, quality_score: 60 },
        ],
        0,
        0,
        50000,
        100
      )
    ).toMatchSnapshot();
  });

  it("volume credit: light user — 200 lifetime, 5 last-30d", () => {
    // 5 streak + 1 unverified + no badge + 200 lifetime + 5 30d
    // = 10 + 10 + 1 + 0 + floor(log10(200)*4) + floor(5*0.5) = 10+10+1+0+9+2 = 32
    expect(
      calculateVibeScore(
        5,
        1,
        "none",
        0,
        [{ verified: false }],
        0,
        0,
        200,
        5
      )
    ).toMatchSnapshot();
  });

  it("volume credit: brand-new user (0 lifetime) → no volume bonus", () => {
    // log10(max(1,0)) = 0, so volume bonus = 0
    expect(
      calculateVibeScore(0, 0, "none", undefined, undefined, 0, 0, 0, 0)
    ).toBe(10);
  });

  it("volume credit: recent30d cap at 50", () => {
    // 200 contributions in 30d would be +100 uncapped, but cap is 50
    // = 10 + 0 + 0 + 0 + floor(log10(1)*4) + min(floor(200*0.5), 50) = 10+0+0+0+0+50 = 60
    expect(
      calculateVibeScore(0, 0, "none", undefined, undefined, 0, 0, 0, 200)
    ).toBe(60);
  });
});

// ---- calculateProjectScore baseline ----

describe("calculateProjectScore numeric baseline", () => {
  it("unverified project → 1", () => {
    expect(
      calculateProjectScore({
        verified: false,
        live_url: null,
        github_url: null,
        description: "",
        image_url: null,
        tech_stack: [],
      })
    ).toBe(1);
  });

  it("verified with all signals → 15", () => {
    expect(
      calculateProjectScore({
        verified: true,
        live_url: "https://x.com",
        github_url: "https://github.com/x/y",
        description: "A description that is clearly longer than fifty characters for the bonus",
        image_url: "https://img.com/x.png",
        tech_stack: ["a", "b", "c", "d"],
      })
    ).toBe(15);
  });

  it("verified with only base → 5", () => {
    expect(
      calculateProjectScore({
        verified: true,
        live_url: null,
        github_url: null,
        description: "",
        image_url: null,
        tech_stack: [],
      })
    ).toBe(5);
  });

  it("verified with live + github only → 10", () => {
    expect(
      calculateProjectScore({
        verified: true,
        live_url: "https://x.com",
        github_url: "https://github.com/x/y",
        description: "",
        image_url: null,
        tech_stack: [],
      })
    ).toBe(10);
  });
});

// ---- calculateReviewBonus baseline ----

describe("calculateReviewBonus numeric baseline", () => {
  it("no reviews → 0", () => {
    expect(calculateReviewBonus(5, 0)).toBe(0);
  });

  it("5-star × 3 reviews → 30", () => {
    expect(calculateReviewBonus(5, 3)).toBe(30);
  });

  it("caps at 50 for very high rating × count", () => {
    expect(calculateReviewBonus(5, 20)).toBe(50);
  });

  it("rounds mid-values correctly", () => {
    expect(calculateReviewBonus(4.5, 2)).toBe(18);
  });
});

// ---- Badge thresholds baseline (integer boundaries) ----

describe("getBadgeLevel thresholds", () => {
  const cases: [number, string][] = [
    [0, "none"],
    [29, "none"],
    [30, "bronze"],
    [89, "bronze"],
    [90, "silver"],
    [179, "silver"],
    [180, "gold"],
    [364, "gold"],
    [365, "diamond"],
    [1000, "diamond"],
  ];

  it.each(cases)("longestStreak=%i → %s", (streak, expected) => {
    expect(getBadgeLevel(streak)).toBe(expected);
  });
});
