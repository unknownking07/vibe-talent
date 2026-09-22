import { describe, expect, it } from "vitest";
import { getGithubReturnPath, isGithubRecovery } from "../onboarding-flow";

describe("isGithubRecovery", () => {
  it("keeps a new user's GitHub OAuth return in the normal onboarding flow", () => {
    expect(isGithubRecovery(new URLSearchParams("step=2"))).toBe(false);
  });

  it("identifies an explicit dashboard recovery visit", () => {
    expect(isGithubRecovery(new URLSearchParams("step=2&mode=recovery"))).toBe(true);
  });
});

describe("getGithubReturnPath", () => {
  it("returns new users to the project-eligible onboarding flow", () => {
    expect(getGithubReturnPath(false)).toBe("/auth/profile-setup?step=2");
  });

  it("preserves recovery mode through GitHub OAuth", () => {
    expect(getGithubReturnPath(true)).toBe("/auth/profile-setup?step=2&mode=recovery");
  });
});
