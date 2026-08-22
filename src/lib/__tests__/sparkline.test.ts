import { describe, it, expect } from "vitest";

import { buildSparkline } from "@/lib/sparkline";

describe("buildSparkline", () => {
  it("returns null below two points", () => {
    expect(buildSparkline([], 100, 40)).toBeNull();
    expect(buildSparkline([1], 100, 40)).toBeNull();
  });

  it("spreads points evenly across the width", () => {
    const shape = buildSparkline([1, 2, 3], 100, 40)!;
    const xs = shape.line.split(" ").map((p) => Number(p.split(",")[0]));
    expect(xs).toEqual([0, 50, 100]);
  });

  it("puts the highest value at the top and the lowest at the bottom", () => {
    const shape = buildSparkline([1, 5], 100, 40, 2)!;
    const ys = shape.line.split(" ").map((p) => Number(p.split(",")[1]));
    // First point is the low, so it sits lower down the SVG than the high.
    expect(ys[0]).toBeGreaterThan(ys[1]!);
    expect(ys[1]).toBeCloseTo(2, 5); // top, inset by the padding
    expect(ys[0]).toBeCloseTo(38, 5); // bottom, inset by the padding
  });

  it("draws a flat series down the middle, not along the floor", () => {
    const shape = buildSparkline([7, 7, 7], 100, 40)!;
    const ys = shape.line.split(" ").map((p) => Number(p.split(",")[1]));
    for (const y of ys) expect(y).toBeCloseTo(20, 5);
  });

  it("closes the area path along the bottom edge", () => {
    const shape = buildSparkline([1, 2], 100, 40)!;
    expect(shape.area.startsWith("M0,40 L")).toBe(true);
    expect(shape.area.endsWith("L100,40 Z")).toBe(true);
  });

  it("survives a series with an extreme outlier", () => {
    const shape = buildSparkline([0.000001, 0.4, 0.000002], 120, 40)!;
    const ys = shape.line.split(" ").map((p) => Number(p.split(",")[1]));
    expect(ys.every((y) => y >= 0 && y <= 40)).toBe(true);
  });
});
