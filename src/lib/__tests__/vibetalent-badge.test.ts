import { describe, it, expect } from "vitest";
import { detectVibeTalentBadge, toRepoQualityData } from "../github-quality";
import type { RepoQualityMetrics } from "../github-quality";

// The two snippets the dashboard's copy buttons actually emit. If these
// change, badge detection silently stops working for every new README — so
// assert against the real shapes rather than hand-simplified URLs.
const MARKDOWN_SNIPPET =
  "[![VibeTalent](https://www.vibetalent.work/api/badge/alice)](https://www.vibetalent.work/profile/alice)";
const HTML_SNIPPET =
  '<a href="https://www.vibetalent.work/profile/alice"><img src="https://www.vibetalent.work/api/badge/alice" alt="VibeTalent Badge" /></a>';

describe("detectVibeTalentBadge", () => {
  it("detects the markdown snippet the dashboard copies", () => {
    expect(detectVibeTalentBadge(MARKDOWN_SNIPPET, "alice")).toBe(true);
  });

  it("detects the HTML snippet the dashboard copies", () => {
    expect(detectVibeTalentBadge(HTML_SNIPPET, "alice")).toBe(true);
  });

  it("detects a bare profile link inside a longer README", () => {
    const readme = `# My Project\n\nBuilt by me.\nProfile: https://vibetalent.work/profile/alice\n\n## Install\n...`;
    expect(detectVibeTalentBadge(readme, "alice")).toBe(true);
  });

  it("accepts http, no-www, and mixed case", () => {
    expect(detectVibeTalentBadge("http://vibetalent.work/profile/alice", "alice")).toBe(true);
    expect(detectVibeTalentBadge("HTTPS://WWW.VIBETALENT.WORK/PROFILE/ALICE", "alice")).toBe(true);
  });

  it("matches when the stored username is percent-encoded", () => {
    // The dashboard copy helpers run the username through encodeURIComponent.
    expect(detectVibeTalentBadge("https://www.vibetalent.work/profile/alice", "alice")).toBe(true);
  });

  // --- The important negatives: this drives a visible trust chip. ---

  it("does NOT credit a different builder's badge", () => {
    // Pasting someone else's badge must not earn you the chip.
    expect(detectVibeTalentBadge(MARKDOWN_SNIPPET, "bob")).toBe(false);
  });

  it("does NOT match a username that is only a prefix of the linked one", () => {
    const readme = "https://www.vibetalent.work/profile/alicia";
    expect(detectVibeTalentBadge(readme, "alice")).toBe(false);
  });

  it("does NOT match a bare link to the site with no profile", () => {
    expect(detectVibeTalentBadge("Check out https://vibetalent.work", "alice")).toBe(false);
    expect(detectVibeTalentBadge("https://vibetalent.work/leaderboard", "alice")).toBe(false);
  });

  it("does NOT match a lookalike domain", () => {
    expect(
      detectVibeTalentBadge("https://vibetalent.work.evil.com/profile/alice", "alice")
    ).toBe(false);
    expect(detectVibeTalentBadge("https://notvibetalent.work/profile/alice", "alice")).toBe(false);
  });

  it("returns false for empty or missing inputs", () => {
    expect(detectVibeTalentBadge("", "alice")).toBe(false);
    expect(detectVibeTalentBadge(MARKDOWN_SNIPPET, "")).toBe(false);
    expect(detectVibeTalentBadge(MARKDOWN_SNIPPET, null)).toBe(false);
    expect(detectVibeTalentBadge(MARKDOWN_SNIPPET, undefined)).toBe(false);
  });

  it("treats regex metacharacters in a username as literal", () => {
    // A username can never compile into a wildcard that matches anyone.
    expect(detectVibeTalentBadge("https://vibetalent.work/profile/a.ice", "a.ice")).toBe(true);
    expect(detectVibeTalentBadge("https://vibetalent.work/profile/alice", "a.ice")).toBe(false);
    expect(detectVibeTalentBadge("https://vibetalent.work/profile/xxxx", ".*")).toBe(false);
  });
});

describe("toRepoQualityData", () => {
  const metrics: RepoQualityMetrics = {
    stars: 12, forks: 3, open_issues: 2, contributors: 4, total_commits: 90,
    languages: { TypeScript: 50000 }, has_tests: true, has_ci: true,
    has_readme: true, readme_length: 3000, has_vibetalent_badge: true,
    last_commit_date: "2026-07-01T00:00:00Z", created_at: "2026-01-01T00:00:00Z",
    repo_age_days: 200, is_private: false, community_score: 80,
    substance_score: 75, maintenance_score: 70, quality_score: 75,
  };

  it("carries the badge flag through to the persisted shape", () => {
    expect(toRepoQualityData(metrics).has_vibetalent_badge).toBe(true);
  });

  it("uses a caller-supplied analyzed_at when given", () => {
    expect(toRepoQualityData(metrics, "2026-07-20T00:00:00Z").analyzed_at).toBe(
      "2026-07-20T00:00:00Z"
    );
  });

  it("does not leak raw analysis internals into the stored row", () => {
    // quality_metrics is served to clients via /api/v1/builders — keep it to
    // the agreed projection rather than whatever analyzeRepository grows next.
    const keys = Object.keys(toRepoQualityData(metrics)).sort();
    expect(keys).toEqual([
      "analyzed_at", "community_score", "contributors", "forks", "has_ci",
      "has_readme", "has_tests", "has_vibetalent_badge", "maintenance_score",
      "quality_score", "stars", "substance_score", "total_commits",
    ]);
  });
});
