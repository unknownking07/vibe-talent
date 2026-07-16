import { describe, it, expect } from "vitest";
import { buildAgentSystemPrompt } from "../prompt";
import { SUPPORT_EMAIL } from "@/lib/support-knowledge";

describe("buildAgentSystemPrompt", () => {
  it("includes the platform facts and the never-invent rule", () => {
    const prompt = buildAgentSystemPrompt(null);
    expect(prompt).toContain("Vibe Score");
    expect(prompt).toContain("search_builders");
    expect(prompt).toContain("NEVER invent");
    expect(prompt).toContain(SUPPORT_EMAIL);
  });

  it("describes an anonymous visitor when no viewer is present", () => {
    const prompt = buildAgentSystemPrompt(null);
    expect(prompt).toContain("not signed in");
    expect(prompt).not.toContain("signed in as @");
  });

  it("injects the signed-in user's real stats", () => {
    const prompt = buildAgentSystemPrompt({
      username: "abhi",
      vibe_score: 412,
      streak: 21,
      longest_streak: 60,
      badge_level: "bronze",
      projects_count: 1,
    });
    expect(prompt).toContain("signed in as @abhi");
    expect(prompt).toContain("vibe score 412");
    expect(prompt).toContain("21 days");
    expect(prompt).toContain("1 project");
    expect(prompt).not.toContain("1 projects");
    expect(prompt).not.toContain("not signed in");
  });
});
