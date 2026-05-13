import { describe, it, expect } from "vitest";
import { classifyTier } from "../tier";

describe("classifyTier", () => {
  it("returns null when calibration is null", () => {
    expect(classifyTier(null, 50)).toBeNull();
  });

  it("returns null below bronze thresholds", () => {
    expect(classifyTier(60, 100)).toBeNull();   // 60% cal fails bronze 70% min
    expect(classifyTier(75, 5)).toBeNull();     // 5 reviews fails bronze 10 min
  });

  it("returns bronze when both bronze minimums met", () => {
    expect(classifyTier(70, 10)).toBe("bronze");
    expect(classifyTier(79, 29)).toBe("bronze");
  });

  it("returns silver when both silver minimums met", () => {
    expect(classifyTier(80, 30)).toBe("silver");
    expect(classifyTier(84, 74)).toBe("silver");
  });

  it("returns gold when both gold minimums met", () => {
    expect(classifyTier(85, 75)).toBe("gold");
    expect(classifyTier(100, 1000)).toBe("gold");
  });

  it("uses the lower tier when one threshold is met but not both", () => {
    expect(classifyTier(85, 30)).toBe("silver");  // high cal, silver review count
    expect(classifyTier(72, 75)).toBe("bronze");  // many reviews, bronze cal
  });
});
