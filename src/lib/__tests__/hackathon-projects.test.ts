import { describe, it, expect } from "vitest";

import {
  HACKATHON_PROJECTS,
  hackathonProjectsFor,
  isHackathonBuilder,
} from "@/lib/hackathon-projects";

describe("HACKATHON_PROJECTS", () => {
  it("holds the 45 DoraHacks submissions plus the winners announced elsewhere", () => {
    const submissions = HACKATHON_PROJECTS.filter((p) => p.githubOwner);
    const winners = HACKATHON_PROJECTS.filter((p) => p.winner);
    expect(submissions).toHaveLength(45);
    expect(winners.length).toBeGreaterThan(0);
  });

  it("names every entry and gives it a track", () => {
    for (const p of HACKATHON_PROJECTS) {
      expect(p.name.trim()).not.toBe("");
      expect(p.track.trim()).not.toBe("");
    }
  });

  it("lists a winner who never went through DoraHacks", () => {
    // VaultBags won and has no submission, so an entry without a repository
    // has to be representable or the roster silently omits the prize list.
    const vault = HACKATHON_PROJECTS.find((p) => p.name === "VaultBags");
    expect(vault).toMatchObject({ githubOwner: null, winner: true });
  });

  it("never matches a builder to an entry with no repository", () => {
    // A null owner must not collapse into a shared map key and hand one
    // builder every unattributed winner.
    expect(hackathonProjectsFor(null)).toEqual([]);
    expect(hackathonProjectsFor("")).toEqual([]);
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
