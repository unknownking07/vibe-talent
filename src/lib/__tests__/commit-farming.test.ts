import { afterEach, describe, expect, it, vi } from "vitest";
import { calculateVibeScore } from "../streak";
import { analyzeRepository } from "../github-quality";
import { computeActiveBuilders } from "../leaderboard/weekly";

afterEach(() => vi.unstubAllGlobals());

describe("commit farming cannot increase scores or break ranking ties", () => {
  it("ignores lifetime/recent contributions, streaks and earned activity badges", () => {
    const projects = [{ verified: true, quality_score: 80 }];
    expect(
      calculateVibeScore(99999, 1, "diamond", 1, projects, 20, 2, 1e9, 1e9),
    ).toBe(calculateVibeScore(0, 1, "none", 1, projects, 20, 2, 0, 0));
  });

  it("does not let historical activity-derived quality scores smuggle points back in", () => {
    const score = (quality_score: number) =>
      calculateVibeScore(0, 1, "none", 1, [{ verified: true, quality_score }]);
    expect(score(100)).toBe(score(0));
  });

  it("ranks higher reputation above fake commit volume, with neutral ties", () => {
    const users = [
      {
        id: "a",
        username: "alice",
        avatar_url: null,
        rank: 1,
        vibe_score: 100,
        streak: 0,
      },
      {
        id: "b",
        username: "bot",
        avatar_url: null,
        rank: 3,
        vibe_score: 10,
        streak: 9999,
      },
      {
        id: "c",
        username: "charlie",
        avatar_url: null,
        rank: 2,
        vibe_score: 100,
        streak: 9999,
      },
    ];
    const days = new Map([
      ["a", 1],
      ["b", 7],
      ["c", 7],
    ]);
    const commits = new Map([
      ["a", 1],
      ["b", 1e9],
      ["c", 1e9],
    ]);
    expect(
      computeActiveBuilders(days, commits, users).map((u) => u.username),
    ).toEqual(["alice", "charlie", "bot"]);
  });

  it("one fake activity day cannot change weekly eligibility or rank", () => {
    const users = [
      {
        id: "a",
        username: "alice",
        avatar_url: null,
        rank: 1,
        vibe_score: 100,
        streak: 0,
      },
    ];
    const before = computeActiveBuilders(new Map(), new Map(), users);
    const after = computeActiveBuilders(
      new Map([["a", 7]]),
      new Map([["a", 1e9]]),
      users,
    );
    expect(before.map((u) => u.username)).toEqual(after.map((u) => u.username));
    expect(before[0].currentRank).toBe(after[0].currentRank);
  });

  it("repository scores ignore commit count, push recency, aliases and code volume", async () => {
    let farming = false;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/languages"))
          return Response.json(
            farming
              ? { TypeScript: 1e9, JavaScript: 1e9 }
              : { TypeScript: 100 },
          );
        if (url.includes("/contributors"))
          return Response.json([], {
            headers: farming
              ? { link: '<https://api.github.com/x?page=9999>; rel="last"' }
              : {},
          });
        if (url.includes("/git/trees/"))
          return Response.json({
            tree: [
              { path: "README.md" },
              { path: "src/app.test.ts" },
              { path: ".github/workflows/test.yml" },
            ],
          });
        if (url.includes("/readme"))
          return Response.json({ size: farming ? 1e9 : 20 });
        if (url.includes("/commits"))
          return Response.json([{}], {
            headers: farming
              ? { link: '<https://api.github.com/x?page=1000000>; rel="last"' }
              : {},
          });
        return Response.json({
          created_at: "2020-01-01T00:00:00Z",
          pushed_at: farming
            ? new Date().toISOString()
            : "2020-01-01T00:00:00Z",
          stargazers_count: 0,
          forks_count: 0,
          open_issues_count: 0,
        });
      }),
    );
    const before = await analyzeRepository("alice", "app");
    farming = true;
    const after = await analyzeRepository("alice", "app");
    expect(before.success && after.success).toBe(true);
    expect(after.metrics!.total_commits).toBe(1_000_000);
    expect(after.metrics!.quality_score).toBe(before.metrics!.quality_score);
  });
});
