import { describe, it, expect } from "vitest";

import {
  HACKATHON_PROJECTS,
  hackathonProjectsFor,
  isHackathonBuilder,
} from "@/lib/hackathon-projects";

describe("HACKATHON_PROJECTS", () => {
  it("holds the whole closed cohort", () => {
    // The DoraHacks submission window closed on 2026-05-11 with 45 entries.
    // If this number moves, the list was edited by hand and should be
    // re-derived from the source rather than patched.
    expect(HACKATHON_PROJECTS).toHaveLength(45);
  });

  it("gives every entry the GitHub owner that makes it joinable", () => {
    for (const p of HACKATHON_PROJECTS) {
      expect(p.githubOwner.trim()).not.toBe("");
      expect(p.name.trim()).not.toBe("");
      expect(p.track.trim()).not.toBe("");
    }
  });
});

describe("hackathonProjectsFor", () => {
  it("matches a builder against their submission", () => {
    // Real match in production: mrarindam submitted TokenSight Ai.
    expect(hackathonProjectsFor("mrarindam")).toEqual([
      { name: "TokenSight Ai", githubOwner: "mrarindam", track: "AI Agents" },
    ]);
  });

  it("matches regardless of case, because GitHub does", () => {
    // Production has a builder signed up as "25th" whose GitHub is "iam25th1".
    expect(hackathonProjectsFor("IAm25th1")).toHaveLength(1);
    expect(hackathonProjectsFor("iam25th1")[0]!.name).toBe("BagsBrain");
  });

  it("returns every submission from a builder who entered twice", () => {
    // Showing one of two would understate what they did.
    const projects = hackathonProjectsFor("garib7");
    expect(projects).toHaveLength(2);
    expect(projects.map((p) => p.name).sort()).toEqual([
      "GhostAgent Protocol",
      "GhostComm - Social Proxy",
    ]);
  });

  it("ignores surrounding whitespace on a stored handle", () => {
    expect(hackathonProjectsFor("  mrarindam  ")).toHaveLength(1);
  });

  it("returns nothing for a builder who did not enter", () => {
    expect(hackathonProjectsFor("unknownking07")).toEqual([]);
  });

  it("returns nothing for a builder with no GitHub at all", () => {
    // Wallet linking does not require GitHub, so this is a normal case.
    expect(hackathonProjectsFor(null)).toEqual([]);
    expect(hackathonProjectsFor(undefined)).toEqual([]);
    expect(hackathonProjectsFor("   ")).toEqual([]);
  });
});

describe("isHackathonBuilder", () => {
  it("is true only for owners in the cohort", () => {
    expect(isHackathonBuilder("mrarindam")).toBe(true);
    expect(isHackathonBuilder("unknownking07")).toBe(false);
    expect(isHackathonBuilder(null)).toBe(false);
  });
});
