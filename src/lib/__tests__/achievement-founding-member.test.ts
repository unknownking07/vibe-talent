import { describe, it, expect } from "vitest";

import {
  ACHIEVEMENTS,
  type AchievementCounters,
} from "@/lib/achievements/definitions";

const foundingMember = ACHIEVEMENTS.find((a) => a.id === "founding_member")!;

/**
 * `joinedAt` reaches this as `users.created_at`, a Postgres TIMESTAMPTZ, which
 * arrives as a full ISO-8601 string rather than the bare date the cutoff is
 * written as. The comparison is lexical, so these cases pin the behaviour that
 * makes that safe — and would catch it breaking if the cutoff ever gained a
 * time component or the column started arriving in another format.
 */
function counters(joinedAt: string | null): AchievementCounters {
  return {
    currentStreak: 0,
    longestStreak: 0,
    projectCount: 0,
    verifiedProjectCount: 0,
    topQualityScore: 0,
    endorsementsReceived: 0,
    hireRequestsReceived: 0,
    completedHires: 0,
    reviewsGiven: 0,
    hasGithubLinked: false,
    referralCount: 0,
    joinedAt,
  } as AchievementCounters;
}

describe("founding_member", () => {
  it("is earned by someone who joined on launch day", () => {
    // The real shape: a TIMESTAMPTZ, not a bare date.
    expect(
      foundingMember.progress(counters("2026-03-17T13:07:20.455349+00:00")),
    ).toBe(1);
  });

  it("is earned right up to the last moment before the cutoff", () => {
    expect(
      foundingMember.progress(counters("2026-03-23T23:59:59.999999+00:00")),
    ).toBe(1);
  });

  it("is NOT earned on the cutoff day itself", () => {
    // The cutoff is exclusive: the founding cohort is the first week, and
    // 2026-03-24 is the day after it ends.
    expect(
      foundingMember.progress(counters("2026-03-24T00:00:00.000000+00:00")),
    ).toBe(0);
    expect(foundingMember.progress(counters("2026-03-24"))).toBe(0);
  });

  it("is not earned by anyone who joined later", () => {
    expect(foundingMember.progress(counters("2026-08-01T09:00:00+00:00"))).toBe(
      0,
    );
  });

  it("is not earned when the join date is missing", () => {
    // created_at is nullable in the fetch layer, and a null must not read as
    // "joined before the cutoff".
    expect(foundingMember.progress(counters(null))).toBe(0);
  });
});
