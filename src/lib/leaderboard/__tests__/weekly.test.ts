import { describe, it, expect } from "vitest";
import { computeActiveBuilders, computeClimbers, MIN_VIBE_FLOOR } from "../weekly";

describe("computeClimbers", () => {
  it("sorts by rank-position climb desc", () => {
    const snapshots = [
      { user_id: "a", rank: 80, vibe_score: 200 },
      { user_id: "b", rank: 50, vibe_score: 775 },
      { user_id: "c", rank: 15, vibe_score: 750 },
    ];
    const current = [
      { id: "a", username: "maya", vibe_score: 280, rank: 38, avatar_url: null },
      { id: "b", username: "abhi", vibe_score: 847, rank: 38, avatar_url: null },
      { id: "c", username: "kai",  vibe_score: 850, rank: 8,  avatar_url: null },
    ];
    const result = computeClimbers(snapshots, current);
    expect(result.map((r) => r.username)).toEqual(["maya", "abhi", "kai"]);
    // maya: ▲42, abhi: ▲12, kai: ▲7
    expect(result[0].rankClimb).toBe(42);
    expect(result[0].scoreDelta).toBe(80);
  });

  it("filters out users below the vibe_score floor", () => {
    const snapshots = [
      { user_id: "n", rank: 999, vibe_score: 5 },
    ];
    const current = [
      { id: "n", username: "newbie", vibe_score: 50, rank: 200, avatar_url: null },
    ];
    expect(computeClimbers(snapshots, current)).toEqual([]);
    expect(MIN_VIBE_FLOOR).toBe(100);
  });

  it("includes users with no prior snapshot but marks rankClimb as null", () => {
    const snapshots: Array<{ user_id: string; rank: number; vibe_score: number }> = [];
    const current = [
      { id: "x", username: "fresh", vibe_score: 150, rank: 60, avatar_url: null },
    ];
    const result = computeClimbers(snapshots, current);
    expect(result).toHaveLength(1);
    expect(result[0].rankClimb).toBeNull();
    expect(result[0].scoreDelta).toBeNull();
  });
});

describe("computeActiveBuilders", () => {
  it("filters out users with 0 active days", () => {
    const active = new Map<string, number>([["a", 5]]);
    const current = [
      { id: "a", username: "alpha", vibe_score: 200, streak: 5, avatar_url: null, rank: 10 },
      { id: "b", username: "beta",  vibe_score: 500, streak: 0, avatar_url: null, rank: 5 },
    ];
    const result = computeActiveBuilders(active, current);
    expect(result.map(r => r.username)).toEqual(["alpha"]);
  });

  it("sorts by active days desc, then streak desc, then vibe_score desc", () => {
    const active = new Map<string, number>([["a", 5], ["b", 5], ["c", 7]]);
    const current = [
      { id: "a", username: "alpha", vibe_score: 200, streak: 3, avatar_url: null, rank: 10 },
      { id: "b", username: "beta",  vibe_score: 100, streak: 10, avatar_url: null, rank: 30 },
      { id: "c", username: "cara",  vibe_score: 500, streak: 1, avatar_url: null, rank: 5 },
    ];
    const result = computeActiveBuilders(active, current);
    // cara first (7 days), then beta (5 days + higher streak), then alpha (5 days + lower streak)
    expect(result.map(r => r.username)).toEqual(["cara", "beta", "alpha"]);
  });
});
