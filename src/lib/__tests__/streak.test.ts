import { describe, it, expect } from "vitest";
import {
  calculateStreak,
  calculateVibeScore,
  calculateProjectScore,
  getBadgeLevel,
  getBadgeInfo,
} from "../streak";
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
    const dates = [
      "2025-01-01",
      "2025-01-02",
      "2025-01-03",
      "2025-01-04",
      "2025-01-05",
    ];
    const result = calculateStreak(dates);
    expect(result.longestStreak).toBe(5);
  });

  it("handles gaps between streaks", () => {
    const dates = [
      "2025-01-01",
      "2025-01-02",
      "2025-01-03", // 3-day streak
      "2025-01-10",
      "2025-01-11", // 2-day streak
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
    const toLocalDate = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

describe("commit-independent vibe and project scores", () => {
  const project: ProjectScoreInput = {
    verified: true, live_url: "https://example.com", live_url_ok: true,
    quality_metrics: { has_readme: true, has_tests: true, has_ci: true },
  };

  it("gives a baseline without trusted project evidence", () => {
    expect(calculateVibeScore(0, 0, "none")).toBe(10);
    expect(calculateVibeScore(10000, 10000, "diamond", 10000)).toBe(10);
  });

  it("scores the strongest project once, regardless of duplicate volume", () => {
    expect(calculateProjectScore(project)).toBe(100);
    expect(calculateVibeScore(0, [project], "none")).toBe(110);
    expect(calculateVibeScore(999, Array(1000).fill(project), "diamond")).toBe(110);
  });

  it("excludes unverified, private, and flagged work", () => {
    for (const excluded of [{ verified:false }, { is_private:true }, { flagged:true }]) {
      expect(calculateVibeScore(0, [{ ...project, ...excluded }], "none")).toBe(10);
    }
  });

  it("requires observed reachability instead of a typed URL", () => {
    expect(calculateProjectScore({ ...project, live_url_ok:null })).toBe(80);
    expect(calculateProjectScore({ ...project, live_url_ok:false })).toBe(80);
  });

  it("does not award points for self-reported description, screenshot or tech list", () => {
    expect(calculateProjectScore({ verified:true, description:"x".repeat(500), image_url:"https://example.com/img", tech_stack:["React","Node","SQL"] })).toBe(40);
  });

  it("preserves community feedback separately from activity", () => {
    expect(calculateVibeScore(999, [project], "diamond", undefined, undefined, 20, 3, 1e9, 1e9)).toBe(145);
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
