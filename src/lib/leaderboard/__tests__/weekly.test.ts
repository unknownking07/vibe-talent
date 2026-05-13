import { describe, it, expect } from "vitest";
import { computeClimbers, MIN_VIBE_FLOOR } from "../weekly";

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
