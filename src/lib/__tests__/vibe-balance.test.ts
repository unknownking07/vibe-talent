import { describe, it, expect } from "vitest";
import { isBalanceStale, toWholeVibe, balanceUsd } from "../vibe-balance";

describe("isBalanceStale", () => {
  it("treats a never-fetched balance as stale", () => {
    expect(isBalanceStale(null)).toBe(true);
  });

  it("treats a just-fetched balance as fresh", () => {
    expect(isBalanceStale(new Date().toISOString())).toBe(false);
  });

  it("treats a balance older than the cooldown as stale", () => {
    expect(isBalanceStale(new Date(Date.now() - 120_000).toISOString())).toBe(
      true,
    );
  });

  it("treats an unparseable timestamp as stale rather than fresh", () => {
    // Failing open here would pin a bad cache value forever.
    expect(isBalanceStale("not-a-date")).toBe(true);
  });
});

describe("toWholeVibe", () => {
  it("divides by the 9-decimal base", () => {
    expect(toWholeVibe(BigInt("2078000000000000"))).toBe(2_078_000);
  });

  it("is zero for an empty wallet", () => {
    expect(toWholeVibe(BigInt(0))).toBe(0);
  });
});

describe("balanceUsd", () => {
  it("prices a balance at the given rate", () => {
    // 2.078M $VIBE at $0.0000024 ≈ $4.99
    expect(balanceUsd(BigInt("2078000000000000"), 0.0000024)).toBeCloseTo(
      4.9872,
      4,
    );
  });

  it("is zero for an empty wallet", () => {
    expect(balanceUsd(BigInt(0), 0.0000024)).toBe(0);
  });
});
