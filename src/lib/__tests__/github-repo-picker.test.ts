import { describe, expect, it } from "vitest";
import { toRepoPickerOptions } from "../github-repo-picker";

const identity = { username: "octocat", id: 42 };

function repo(overrides: Record<string, unknown> = {}) {
  return {
    name: "hello-world",
    html_url: "https://github.com/octocat/hello-world",
    description: "A useful app",
    language: "TypeScript",
    private: false,
    fork: false,
    archived: false,
    disabled: false,
    owner: { login: "octocat", id: 42 },
    ...overrides,
  };
}

describe("toRepoPickerOptions", () => {
  it("returns editable form details for a public repo owned by the linked identity", () => {
    expect(toRepoPickerOptions([repo()], identity)).toEqual([{
      name: "hello-world",
      description: "A useful app",
      language: "TypeScript",
      github_url: "https://github.com/octocat/hello-world",
    }]);
  });

  it("excludes private, forked, archived, disabled, and mismatched-owner repos", () => {
    const options = toRepoPickerOptions([
      repo({ private: true }),
      repo({ fork: true }),
      repo({ archived: true }),
      repo({ disabled: true }),
      repo({ owner: { login: "octocat", id: 99 } }),
      repo({ owner: { login: "another-user", id: 42 } }),
      repo({ html_url: "https://github.com/another-user/hello-world" }),
      repo(),
    ], identity);

    expect(options).toHaveLength(1);
  });

  it("keeps repos with empty metadata selectable so builders can fill it in", () => {
    expect(toRepoPickerOptions([repo({ description: null, language: null })], identity)).toEqual([{
      name: "hello-world",
      description: "",
      language: "",
      github_url: "https://github.com/octocat/hello-world",
    }]);
  });

  it("requires the owner handle when an older GitHub identity has no numeric ID", () => {
    expect(toRepoPickerOptions([repo()], { username: "octocat", id: null })).toHaveLength(1);
    expect(toRepoPickerOptions([repo()], { username: "someone-else", id: null })).toEqual([]);
  });
});
