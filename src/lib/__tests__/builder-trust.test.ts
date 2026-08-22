import { describe, it, expect } from "vitest";

import {
  assessBuilderTrust,
  hasVerifiableRecord,
  percentileOf,
  rankedCohort,
  type BuilderTrustInput,
} from "@/lib/builder-trust";

function builder(over: Partial<BuilderTrustInput> = {}): BuilderTrustInput {
  return {
    vibeScore: 100,
    verifiedProjects: 1,
    lifetimeContributions: 200,
    longestStreak: 10,
    ...over,
  };
}

describe("rankedCohort", () => {
  it("drops accounts sitting on the untouched baseline", () => {
    // Signed-up-and-left rows would otherwise push every active builder into
    // the top decile.
    expect(rankedCohort([10, 10, 47, 265, 5])).toEqual([47, 265]);
  });
});

describe("percentileOf", () => {
  it("measures the share of the cohort scoring strictly below", () => {
    expect(percentileOf(50, [10, 20, 30, 40])).toBe(100);
    expect(percentileOf(25, [10, 20, 30, 40])).toBe(50);
    expect(percentileOf(5, [10, 20, 30, 40])).toBe(0);
  });

  it("does not credit a builder for the peers they merely tied", () => {
    expect(percentileOf(20, [20, 20, 20, 20])).toBe(0);
  });

  it("has nothing to measure against an empty cohort", () => {
    expect(percentileOf(100, [])).toBeNull();
  });
});

describe("hasVerifiableRecord", () => {
  it("accepts a verified project", () => {
    expect(
      hasVerifiableRecord(
        builder({ verifiedProjects: 1, lifetimeContributions: 0 }),
      ),
    ).toBe(true);
  });

  it("accepts attributed commits", () => {
    expect(
      hasVerifiableRecord(
        builder({ verifiedProjects: 0, lifetimeContributions: 5 }),
      ),
    ).toBe(true);
  });

  it("rejects a record that is only a streak", () => {
    // Production case: a 115-day streak with no verified project and no
    // attributed commits. Ranking that in the top decile next to a token
    // launch would vouch for something nobody outside our database can check.
    expect(
      hasVerifiableRecord(
        builder({
          verifiedProjects: 0,
          lifetimeContributions: 0,
          longestStreak: 115,
        }),
      ),
    ).toBe(false);
  });
});

describe("assessBuilderTrust", () => {
  const cohort = [20, 40, 60, 80, 100, 200, 265, 280, 630];

  it("ranks a builder with a verifiable record", () => {
    const trust = assessBuilderTrust(builder({ vibeScore: 265 }), cohort);
    expect(trust.sufficient).toBe(true);
    expect(trust.percentile).toBe(67);
    expect(trust.label).toBe("Top 33% of builders");
    expect(trust.caveat).toBeNull();
  });

  it("withholds the rank when the record is only a streak, and says why", () => {
    const trust = assessBuilderTrust(
      builder({
        vibeScore: 280,
        verifiedProjects: 0,
        lifetimeContributions: 0,
        longestStreak: 115,
      }),
      cohort,
    );

    // The highest score in this set, and still unranked: score alone is not
    // evidence when none of it came from outside the platform.
    expect(trust.percentile).toBeNull();
    expect(trust.sufficient).toBe(false);
    expect(trust.label).toBe("Limited public record");
    expect(trust.caveat).toContain("no GitHub-verified project");
  });

  it("does not claim a top percentage for a below-median builder", () => {
    const trust = assessBuilderTrust(builder({ vibeScore: 30 }), cohort);
    expect(trust.sufficient).toBe(true);
    expect(trust.label).toBe("Ranked builder");
  });

  it("never advertises 'top 0%'", () => {
    const trust = assessBuilderTrust(builder({ vibeScore: 10_000 }), cohort);
    expect(trust.percentile).toBe(100);
    expect(trust.label).toBe("Top 1% of builders");
  });

  it("reports honestly when there is no cohort to compare against", () => {
    const trust = assessBuilderTrust(builder(), []);
    expect(trust.percentile).toBeNull();
    expect(trust.label).toBe("Unranked");
  });
});
