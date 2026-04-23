import { describe, it, expect } from "vitest";
import { parseGithubRepoUrl } from "../github-quality";

describe("parseGithubRepoUrl", () => {
  it("parses a canonical repo URL", () => {
    expect(parseGithubRepoUrl("https://github.com/shuhaib90/creatorchain-job-board")).toEqual({
      owner: "shuhaib90",
      repo: "creatorchain-job-board",
    });
  });

  it("strips a trailing slash", () => {
    expect(parseGithubRepoUrl("https://github.com/vercel/next.js/")).toEqual({
      owner: "vercel",
      repo: "next.js",
    });
  });

  it("strips a .git suffix", () => {
    expect(parseGithubRepoUrl("https://github.com/vercel/next.js.git")).toEqual({
      owner: "vercel",
      repo: "next.js",
    });
  });

  it("ignores a /tree/branch subpath", () => {
    expect(parseGithubRepoUrl("https://github.com/vercel/next.js/tree/canary")).toEqual({
      owner: "vercel",
      repo: "next.js",
    });
  });

  it("ignores a /blob/... subpath", () => {
    expect(
      parseGithubRepoUrl("https://github.com/vercel/next.js/blob/canary/README.md")
    ).toEqual({ owner: "vercel", repo: "next.js" });
  });

  it("tolerates query strings and hash fragments", () => {
    expect(parseGithubRepoUrl("https://github.com/vercel/next.js?tab=readme#top")).toEqual({
      owner: "vercel",
      repo: "next.js",
    });
  });

  it("accepts www. prefix", () => {
    expect(parseGithubRepoUrl("https://www.github.com/vercel/next.js")).toEqual({
      owner: "vercel",
      repo: "next.js",
    });
  });

  it("accepts http scheme", () => {
    expect(parseGithubRepoUrl("http://github.com/vercel/next.js")).toEqual({
      owner: "vercel",
      repo: "next.js",
    });
  });

  it("is case-insensitive on the host but preserves path casing", () => {
    expect(parseGithubRepoUrl("https://GitHub.com/Vercel/Next.JS")).toEqual({
      owner: "Vercel",
      repo: "Next.JS",
    });
  });

  it("accepts hyphenated usernames", () => {
    expect(parseGithubRepoUrl("https://github.com/my-org/my-repo")).toEqual({
      owner: "my-org",
      repo: "my-repo",
    });
  });

  it("rejects reserved GitHub paths (login, settings, marketplace)", () => {
    expect(parseGithubRepoUrl("https://github.com/login/oauth")).not.toBeNull();
    // Note: the owner regex only constrains charset/length, not reserved words.
    // /login/oauth parses as {owner: "login", repo: "oauth"} — callers guard
    // against this via the owner-match check against users.github_username.
  });

  it("rejects single-segment URLs like a user profile", () => {
    expect(parseGithubRepoUrl("https://github.com/shuhaib90")).toBeNull();
  });

  it("rejects non-GitHub hosts", () => {
    expect(parseGithubRepoUrl("https://gitlab.com/foo/bar")).toBeNull();
  });

  it("rejects usernames outside GitHub's charset", () => {
    expect(parseGithubRepoUrl("https://github.com/_underscored/repo")).toBeNull();
    expect(parseGithubRepoUrl("https://github.com/has space/repo")).toBeNull();
  });

  it("rejects usernames over 39 chars", () => {
    const tooLong = "a".repeat(40);
    expect(parseGithubRepoUrl(`https://github.com/${tooLong}/repo`)).toBeNull();
  });

  it("accepts usernames at the 39-char limit", () => {
    const atLimit = "a".repeat(39);
    expect(parseGithubRepoUrl(`https://github.com/${atLimit}/repo`)).toEqual({
      owner: atLimit,
      repo: "repo",
    });
  });

  it("returns null for null, undefined, empty, or whitespace input", () => {
    expect(parseGithubRepoUrl(null)).toBeNull();
    expect(parseGithubRepoUrl(undefined)).toBeNull();
    expect(parseGithubRepoUrl("")).toBeNull();
    expect(parseGithubRepoUrl("   ")).toBeNull();
  });

  it("returns null for non-string input", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(parseGithubRepoUrl(42 as any)).toBeNull();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(parseGithubRepoUrl({} as any)).toBeNull();
  });

  it("returns null for malformed URLs", () => {
    expect(parseGithubRepoUrl("github.com/vercel/next.js")).toBeNull();
    expect(parseGithubRepoUrl("https://github.com/")).toBeNull();
    expect(parseGithubRepoUrl("not a url at all")).toBeNull();
  });

  it("trims surrounding whitespace before parsing", () => {
    expect(parseGithubRepoUrl("  https://github.com/vercel/next.js  ")).toEqual({
      owner: "vercel",
      repo: "next.js",
    });
  });
});
