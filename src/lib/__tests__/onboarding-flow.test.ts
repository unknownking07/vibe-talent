import { describe, expect, it } from "vitest";
import { isGithubRecovery } from "../onboarding-flow";

describe("isGithubRecovery", () => {
  it("keeps a new user's GitHub OAuth return in the normal onboarding flow", () => {
    expect(isGithubRecovery(new URLSearchParams("step=2"))).toBe(false);
  });

  it("identifies an explicit dashboard recovery visit", () => {
    expect(isGithubRecovery(new URLSearchParams("step=2&mode=recovery"))).toBe(true);
  });
});
