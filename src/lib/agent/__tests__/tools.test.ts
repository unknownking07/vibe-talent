import { describe, it, expect } from "vitest";
import { normalizeSearchArgs, normalizeUsername, buildReasons } from "../tools";
import type { UserWithSocials } from "@/lib/types/database";

function mockUser(overrides: Partial<UserWithSocials> = {}): UserWithSocials {
  return {
    id: "u1",
    username: "testbuilder",
    display_name: null,
    bio: null,
    avatar_url: null,
    github_username: null,
    vibe_score: 0,
    streak: 0,
    longest_streak: 0,
    badge_level: "none",
    created_at: "2026-01-01T00:00:00Z",
    projects: [],
    social_links: null,
    ...overrides,
  } as UserWithSocials;
}

describe("normalizeSearchArgs", () => {
  it("applies safe defaults for an empty/garbage payload", () => {
    for (const raw of [undefined, null, "nope", 42, {}]) {
      const args = normalizeSearchArgs(raw);
      expect(args).toEqual({
        skills: [],
        projectDescription: "",
        minVibeScore: null,
        activeOnly: false,
        sort: "best_match",
        limit: 3,
      });
    }
  });

  it("lowercases, trims, and drops non-string skills", () => {
    const args = normalizeSearchArgs({
      skills: ["  Next.JS ", "TypeScript", "", 7, null, "   "],
    });
    expect(args.skills).toEqual(["next.js", "typescript"]);
  });

  it("caps the skills list", () => {
    const args = normalizeSearchArgs({ skills: Array.from({ length: 30 }, (_, i) => `s${i}`) });
    expect(args.skills).toHaveLength(10);
  });

  it("clamps limit into 1..6 and rounds it", () => {
    expect(normalizeSearchArgs({ limit: 50 }).limit).toBe(6);
    expect(normalizeSearchArgs({ limit: 0 }).limit).toBe(1);
    expect(normalizeSearchArgs({ limit: -3 }).limit).toBe(1);
    expect(normalizeSearchArgs({ limit: 4.6 }).limit).toBe(5);
    expect(normalizeSearchArgs({ limit: "many" }).limit).toBe(3);
  });

  it("rejects invalid sorts and negative vibe score floors", () => {
    expect(normalizeSearchArgs({ sort: "DROP TABLE" }).sort).toBe("best_match");
    expect(normalizeSearchArgs({ sort: "streak" }).sort).toBe("streak");
    expect(normalizeSearchArgs({ min_vibe_score: -10 }).minVibeScore).toBeNull();
    expect(normalizeSearchArgs({ min_vibe_score: "abc" }).minVibeScore).toBeNull();
    expect(normalizeSearchArgs({ min_vibe_score: 250 }).minVibeScore).toBe(250);
  });

  it("only treats literal true as active_only", () => {
    expect(normalizeSearchArgs({ active_only: true }).activeOnly).toBe(true);
    expect(normalizeSearchArgs({ active_only: "true" }).activeOnly).toBe(false);
  });

  it("truncates a runaway project description", () => {
    const args = normalizeSearchArgs({ project_description: "x".repeat(1000) });
    expect(args.projectDescription).toHaveLength(300);
  });
});

describe("normalizeUsername", () => {
  it("strips the @, trims, and lowercases to the stored canonical form", () => {
    expect(normalizeUsername({ username: " @Some_User " })).toBe("some_user");
  });

  it("rejects missing, empty, oversized, or unsafe values", () => {
    expect(normalizeUsername({})).toBeNull();
    expect(normalizeUsername({ username: "" })).toBeNull();
    expect(normalizeUsername({ username: "@" })).toBeNull();
    expect(normalizeUsername({ username: "a".repeat(61) })).toBeNull();
    expect(normalizeUsername({ username: "user name" })).toBeNull();
    expect(normalizeUsername({ username: "user%wild" })).toBeNull();
    expect(normalizeUsername({ username: 42 })).toBeNull();
  });

  it("accepts typical usernames", () => {
    expect(normalizeUsername({ username: "abhi-k_99.dev" })).toBe("abhi-k_99.dev");
  });
});

describe("buildReasons", () => {
  it("returns verifiable facts only for what the builder actually has", () => {
    const reasons = buildReasons(
      mockUser({
        streak: 45,
        badge_level: "bronze",
        vibe_score: 320,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        projects: [{ verified: true }, { verified: false }] as any,
      })
    );
    expect(reasons).toEqual([
      "45-day active streak",
      "Bronze badge holder",
      "1 GitHub-verified project",
      "Vibe score: 320",
    ]);
  });

  it("stays quiet for an empty profile", () => {
    expect(buildReasons(mockUser())).toEqual([]);
  });
});
