import { describe, it, expect } from "vitest";
import {
  formatTokenCount,
  formatTokenPrice,
  toWholeTokens,
} from "../token-stats";

describe("toWholeTokens", () => {
  it("divides by the 9-decimal base", () => {
    expect(toWholeTokens(BigInt("2078000000000000"))).toBe(2_078_000);
  });

  it("returns 0 for a zero burn", () => {
    expect(toWholeTokens(BigInt(0))).toBe(0);
  });
});

describe("formatTokenCount", () => {
  it("abbreviates by magnitude", () => {
    expect(formatTokenCount(2_078_000)).toBe("2.08M");
    expect(formatTokenCount(998_079_152)).toBe("998.08M");
    expect(formatTokenCount(1_500_000_000)).toBe("1.50B");
    expect(formatTokenCount(4_200)).toBe("4.2K");
  });

  it("shows small counts in full", () => {
    expect(formatTokenCount(0)).toBe("0");
    expect(formatTokenCount(999)).toBe("999");
  });
});

describe("formatTokenPrice", () => {
  it("keeps enough precision for a sub-cent token", () => {
    // $VIBE trades around $0.0000024 — a 2-decimal format would show "$0.00".
    expect(formatTokenPrice(0.000002406)).toBe("$0.000002406");
  });

  it("uses coarser precision as the price rises", () => {
    expect(formatTokenPrice(0.05)).toBe("$0.0500");
    expect(formatTokenPrice(12.5)).toBe("$12.50");
  });
});
