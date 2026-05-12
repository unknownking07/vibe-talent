import { describe, it, expect } from "vitest";
import { notificationTimeAgo } from "../notification-display";

describe("notificationTimeAgo", () => {
  it("returns an empty string for unparseable input rather than 'undefined'", () => {
    // Pre-fix the function silently returned `undefined` for these because
    // NaN comparisons fell through every branch.
    expect(notificationTimeAgo("not a date")).toBe("");
    expect(notificationTimeAgo("")).toBe("");
  });

  it("clamps future timestamps to 'just now' (clock skew tolerance)", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(notificationTimeAgo(future)).toBe("just now");
  });

  it("formats minutes, hours, and days against a recent timestamp", () => {
    const now = Date.now();
    expect(notificationTimeAgo(new Date(now - 5_000).toISOString())).toBe("just now");
    expect(notificationTimeAgo(new Date(now - 5 * 60_000).toISOString())).toBe("5m ago");
    expect(notificationTimeAgo(new Date(now - 3 * 3600_000).toISOString())).toBe("3h ago");
    expect(notificationTimeAgo(new Date(now - 2 * 86400_000).toISOString())).toBe("2d ago");
  });
});
