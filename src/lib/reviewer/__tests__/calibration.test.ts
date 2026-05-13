import { describe, it, expect } from "vitest";
import { computeCalibration } from "../calibration";

describe("computeCalibration", () => {
  it("returns null when reviewer has < 5 reviews", () => {
    const reviews = [
      { rating: 5, builderPercentile: 0.9 },
      { rating: 4, builderPercentile: 0.8 },
    ];
    expect(computeCalibration(reviews)).toBeNull();
  });

  it("returns 100 when every review perfectly matches the builder's percentile", () => {
    // rating 5 → normalized 1.0; builder in 100th percentile → 1.0 → error 0
    const reviews = [
      { rating: 5, builderPercentile: 1.0 },
      { rating: 5, builderPercentile: 1.0 },
      { rating: 5, builderPercentile: 1.0 },
      { rating: 5, builderPercentile: 1.0 },
      { rating: 5, builderPercentile: 1.0 },
    ];
    expect(computeCalibration(reviews)).toBe(100);
  });

  it("returns 0 when every review is maximally wrong", () => {
    // rating 5 → 1.0; builder bottom percentile → 0.0 → error 1.0
    const reviews = Array(5).fill({ rating: 5, builderPercentile: 0.0 });
    expect(computeCalibration(reviews)).toBe(0);
  });

  it("computes a partial calibration correctly", () => {
    // rating 4 → 0.8; builder 0.7 → error 0.1; five copies → mean error 0.1
    // calibration = 100 - 0.1 * 100 = 90
    const reviews = Array(5).fill({ rating: 4, builderPercentile: 0.7 });
    expect(computeCalibration(reviews)).toBe(90);
  });

  it("rounds to 2 decimals", () => {
    const reviews = [
      { rating: 5, builderPercentile: 0.95 }, // error 0.05
      { rating: 4, builderPercentile: 0.75 }, // error 0.05
      { rating: 3, builderPercentile: 0.55 }, // error 0.05
      { rating: 2, builderPercentile: 0.35 }, // error 0.05
      { rating: 1, builderPercentile: 0.15 }, // error 0.05
    ];
    // mean error = 0.05, calibration = 100 - 5 = 95
    expect(computeCalibration(reviews)).toBe(95);
  });
});
