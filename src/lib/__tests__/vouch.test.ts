import { describe, it, expect } from "vitest";
import { voucherCredibility, vouchPoints, totalVouchPoints } from "../vouch";
import { VOUCH } from "../vibe-config";

describe("voucherCredibility", () => {
  it("is zero below the minimum voucher score (the Sybil floor)", () => {
    expect(voucherCredibility(0)).toBe(0);
    expect(voucherCredibility(19)).toBe(0);
  });

  it("starts at 0.55 at the floor and reaches 1.0 at 200", () => {
    expect(voucherCredibility(20)).toBeCloseTo(0.55, 5);
    expect(voucherCredibility(100)).toBeCloseTo(0.75, 5);
    expect(voucherCredibility(200)).toBe(1);
  });

  it("never exceeds 1.0 for very high scores", () => {
    expect(voucherCredibility(718)).toBe(1);
    expect(voucherCredibility(100_000)).toBe(1);
  });
});

describe("vouchPoints", () => {
  // This table is the exact set of cases dry-run against live Postgres before
  // the SQL was written. The SQL and this mirror must agree on every row.
  it("matches the verified SQL results", () => {
    expect(vouchPoints(10, 718)).toBe(3); // $10 at full credibility
    expect(vouchPoints(25, 200)).toBe(5); // hits the per-voucher cap
    expect(vouchPoints(100, 44)).toBe(5); // over-cap at mid credibility
    expect(vouchPoints(2, 400)).toBe(1); // the minimum burn
    expect(vouchPoints(50, 10)).toBe(0); // below the Sybil floor
  });

  it("never exceeds the per-voucher cap", () => {
    expect(vouchPoints(10_000, 718)).toBe(VOUCH.perVoucherCapPoints);
  });

  it("returns zero for a non-positive amount", () => {
    expect(vouchPoints(0, 718)).toBe(0);
    expect(vouchPoints(-5, 718)).toBe(0);
  });
});

describe("totalVouchPoints", () => {
  it("sums per-voucher points and matches the verified profile total", () => {
    // Same five vouchers as the SQL dry run, which totalled 14.
    expect(
      totalVouchPoints([
        { usd: 10, voucherVibeScore: 718 }, // 3
        { usd: 25, voucherVibeScore: 200 }, // 5
        { usd: 100, voucherVibeScore: 44 }, // 5
        { usd: 2, voucherVibeScore: 400 }, // 1
        { usd: 50, voucherVibeScore: 10 }, // 0
      ]),
    ).toBe(14);
  });

  it("caps a whale-backed profile so rank stays unbuyable", () => {
    const many = Array.from({ length: 20 }, () => ({ usd: 25, voucherVibeScore: 300 }));
    expect(totalVouchPoints(many)).toBe(VOUCH.perProfileCapPoints);
  });

  it("ignores vouchers below the credibility floor entirely", () => {
    const sybils = Array.from({ length: 30 }, () => ({ usd: 4, voucherVibeScore: 5 }));
    expect(totalVouchPoints(sybils)).toBe(0);
  });

  it("returns zero for no vouches", () => {
    expect(totalVouchPoints([])).toBe(0);
  });
});
