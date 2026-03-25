import { describe, it, expect } from "vitest";
import { calculateStreak, calculateVibeScore, calculateProjectScore, getBadgeLevel, getBadgeInfo } from "../streak";
import type { ProjectScoreInput } from "../streak";

describe("calculateStreak", () => {
  it("returns 0 for empty array", () => {
    const result = calculateStreak([]);
    expect(result).toEqual({ currentStreak: 0, longestStreak: 0 });
  });

  it("returns 1 for a single date (today)", () => {
    const today = new Date().toISOString().split("T")[0];
    const result = calculateStreak([today]);
    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(1);
  });

  it("counts consecutive days correctly", () => {
    const dates = ["2025-01-01", "2025-01-02", "2025-01-03", "2025-01-04", "2025-01-05"];
    const result = calculateStreak(dates);
    expect(result.longestStreak).toBe(5);
  });

  it("handles gaps between streaks", () => {
    const dates = [
      "2025-01-01", "2025-01-02", "2025-01-03", // 3-day streak
      "2025-01-10", "2025-01-11",                // 2-day streak
    ];
    const result = calculateStreak(dates);
    expect(result.longestStreak).toBe(3);
  });

  it("sets currentStreak to 0 when last activity is more than 1 day ago", () => {
    const oldDate = "2020-01-01";
    const result = calculateStreak([oldDate]);
    expect(result.currentStreak).toBe(0);
    expect(result.longestStreak).toBe(1);
  });

  it("deduplicates dates", () => {
    const today = new Date().toISOString().split("T")[0];
    const result = calculateStreak([today, today, today]);
    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(1);
  });

  it("handles unsorted dates", () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const dayBefore = new Date(today);
    dayBefore.setDate(dayBefore.getDate() - 2);

    const dates = [
      today.toISOString().split("T")[0],
      dayBefore.toISOString().split("T")[0],
      yesterday.toISOString().split("T")[0],
    ];

    const result = calculateStreak(dates);
    expect(result.currentStreak).toBe(3);
    expect(result.longestStreak).toBe(3);
  });

  it("correctly identifies current streak when active today", () => {
    const today = new Date();
    const dates: string[] = [];
    for (let i = 4; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().split("T")[0]);
    }
    const result = calculateStreak(dates);
    expect(result.currentStreak).toBe(5);
  });

  it("correctly identifies current streak when active yesterday", () => {
    const today = new Date();
    const dates: string[] = [];
    const toLocalDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    for (let i = 5; i >= 1; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      dates.push(toLocalDate(d));
    }
    const result = calculateStreak(dates);
    expect(result.currentStreak).toBe(5);
  });
});

describe("getBadgeLevel", () => {
  it("returns 'none' for streaks under 30", () => {
    expect(getBadgeLevel(0)).toBe("none");
    expect(getBadgeLevel(29)).toBe("none");
  });

  it("returns 'bronze' for streaks 30-89", () => {
    expect(getBadgeLevel(30)).toBe("bronze");
    expect(getBadgeLevel(89)).toBe("bronze");
  });

  it("returns 'silver' for streaks 90-179", () => {
    expect(getBadgeLevel(90)).toBe("silver");
    expect(getBadgeLevel(179)).toBe("silver");
  });

  it("returns 'gold' for streaks 180-364", () => {
    expect(getBadgeLevel(180)).toBe("gold");
    expect(getBadgeLevel(364)).toBe("gold");
  });

  it("returns 'diamond' for streaks 365+", () => {
    expect(getBadgeLevel(365)).toBe("diamond");
    expect(getBadgeLevel(1000)).toBe("diamond");
  });
});

describe("calculateVibeScore", () => {
  it("returns 0 for no activity", () => {
    expect(calculateVibeScore(0, 0, "none")).toBe(0);
  });

  it("applies streak multiplier correctly", () => {
    expect(calculateVibeScore(10, 0, "none")).toBe(20); // 10 * 2
  });

  it("applies project multiplier correctly", () => {
    expect(calculateVibeScore(0, 3, "none")).toBe(15); // 3 * 5
  });

  it("applies badge bonus correctly", () => {
    expect(calculateVibeScore(0, 0, "bronze")).toBe(10);
    expect(calculateVibeScore(0, 0, "silver")).toBe(20);
    expect(calculateVibeScore(0, 0, "gold")).toBe(30);
    expect(calculateVibeScore(0, 0, "diamond")).toBe(40);
  });

  it("combines all factors correctly (backward compatible)", () => {
    // Without verifiedCount: treats all as verified
    // 10*2 + 3*5 + 20 = 20 + 15 + 20 = 55
    expect(calculateVibeScore(10, 3, "silver")).toBe(55);
  });

  it("gives full points only to verified projects", () => {
    // 0*2 + (2 verified * 5) + (1 unverified * 1) + 0 = 11
    expect(calculateVibeScore(0, 3, "none", 2)).toBe(11);
  });

  it("penalizes all-unverified projects", () => {
    // 0*2 + (0 verified * 5) + (5 unverified * 1) + 0 = 5
    expect(calculateVibeScore(0, 5, "none", 0)).toBe(5);
    // vs all verified: 0*2 + 5*5 + 0 = 25
    expect(calculateVibeScore(0, 5, "none", 5)).toBe(25);
  });
});

describe("calculateProjectScore", () => {
  const baseProject: ProjectScoreInput = {
    verified: true,
    live_url: null,
    github_url: null,
    description: "Short",
    image_url: null,
    tech_stack: [],
  };

  it("returns 1 for unverified project regardless of quality", () => {
    const project = { ...baseProject, verified: false, live_url: "https://example.com", github_url: "https://github.com/x", description: "A very long description that is over fifty characters for sure", image_url: "https://img.com/x.png", tech_stack: ["React", "Node", "PostgreSQL"] };
    expect(calculateProjectScore(project)).toBe(1);
  });

  it("returns 5 for a bare verified project", () => {
    expect(calculateProjectScore(baseProject)).toBe(5);
  });

  it("adds 3 for live URL", () => {
    expect(calculateProjectScore({ ...baseProject, live_url: "https://example.com" })).toBe(8);
  });

  it("adds 2 for GitHub URL", () => {
    expect(calculateProjectScore({ ...baseProject, github_url: "https://github.com/x" })).toBe(7);
  });

  it("adds 2 for description >50 chars", () => {
    expect(calculateProjectScore({ ...baseProject, description: "A very long description that is definitely over fifty characters long" })).toBe(7);
  });

  it("adds 1 for image", () => {
    expect(calculateProjectScore({ ...baseProject, image_url: "https://img.com/x.png" })).toBe(6);
  });

  it("adds 2 for tech stack ≥3", () => {
    expect(calculateProjectScore({ ...baseProject, tech_stack: ["React", "Node", "PostgreSQL"] })).toBe(7);
  });

  it("maxes out at 15 for a fully loaded verified project", () => {
    const maxProject: ProjectScoreInput = {
      verified: true,
      live_url: "https://example.com",
      github_url: "https://github.com/x",
      description: "A very long description that is definitely over fifty characters long for quality",
      image_url: "https://img.com/x.png",
      tech_stack: ["React", "Node", "PostgreSQL"],
    };
    expect(calculateProjectScore(maxProject)).toBe(15);
  });
});

describe("calculateVibeScore with project details", () => {
  const bareProject: ProjectScoreInput = {
    verified: true,
    live_url: null,
    github_url: null,
    description: "Short",
    image_url: null,
    tech_stack: [],
  };

  const qualityProject: ProjectScoreInput = {
    verified: true,
    live_url: "https://example.com",
    github_url: "https://github.com/x",
    description: "A comprehensive project description that exceeds fifty characters easily",
    image_url: "https://img.com/x.png",
    tech_stack: ["React", "TypeScript", "Tailwind"],
  };

  it("scores project array correctly", () => {
    // 0*2 + 15 (quality) + 5 (bare) + 0 (badge) = 20
    expect(calculateVibeScore(0, [qualityProject, bareProject], "none")).toBe(20);
  });

  it("quality projects outweigh streaks", () => {
    // 3 quality projects: 0*2 + 45 + 0 = 45
    const qualityScore = calculateVibeScore(0, [qualityProject, qualityProject, qualityProject], "none");
    // 20-day streak, no projects: 20*2 + 0 + 0 = 40
    const streakScore = calculateVibeScore(20, [], "none");
    expect(qualityScore).toBeGreaterThan(streakScore);
  });

  it("empty project array gives 0 project points", () => {
    expect(calculateVibeScore(5, [], "none")).toBe(10); // 5*2 + 0 + 0
  });
});

describe("getBadgeInfo", () => {
  it("returns correct info for all badge levels", () => {
    const none = getBadgeInfo("none");
    expect(none.label).toBe("No Badge");
    expect(none.icon).toBe("○");

    const bronze = getBadgeInfo("bronze");
    expect(bronze.label).toBe("Bronze");

    const silver = getBadgeInfo("silver");
    expect(silver.label).toBe("Silver");

    const gold = getBadgeInfo("gold");
    expect(gold.label).toBe("Gold");

    const diamond = getBadgeInfo("diamond");
    expect(diamond.label).toBe("Diamond");
    expect(diamond.icon).toBe("💎");
  });
});
