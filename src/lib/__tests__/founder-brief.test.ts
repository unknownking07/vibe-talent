import { describe, expect, it } from "vitest";
import { parseFounderBrief } from "../founder-brief";

const valid = {
  name: "Ada Lovelace",
  email: "ADA@Startup.io",
  description: "We need a working MVP for our customer onboarding workflow.",
  tech_stack: [" React ", "Supabase", "react"],
  project_type: "mvp",
  timeline: "1_month",
  budget: "2k_5k",
  consent: true,
};

describe("parseFounderBrief", () => {
  it("normalizes a consented brief and sets server-owned fields", () => {
    const result = parseFounderBrief(valid);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      name: "Ada Lovelace",
      email: "ada@startup.io",
      tech_stack: ["React", "Supabase"],
      source: "agent_find",
      status: "new",
    });
    expect(Date.parse(result.value.consent_at)).not.toBeNaN();
  });

  it("requires explicit consent and a real contact email", () => {
    expect(parseFounderBrief({ ...valid, consent: false }).ok).toBe(false);
    expect(parseFounderBrief({ ...valid, consent: "true" }).ok).toBe(false);
    expect(parseFounderBrief({ ...valid, email: "founder@example.com" }).ok).toBe(false);
  });

  it("rejects vague or oversized briefs and unsupported option values", () => {
    expect(parseFounderBrief({ ...valid, description: "Build an app" }).ok).toBe(false);
    expect(parseFounderBrief({ ...valid, description: "x".repeat(3001) }).ok).toBe(false);
    expect(parseFounderBrief({ ...valid, project_type: "crypto_trade" }).ok).toBe(false);
    expect(parseFounderBrief({ ...valid, timeline: "yesterday" }).ok).toBe(false);
    expect(parseFounderBrief({ ...valid, budget: "unknown" }).ok).toBe(false);
    expect(parseFounderBrief({ ...valid, tech_stack: Array(11).fill("React") }).ok).toBe(false);
  });

  it("rejects malformed JSON shapes", () => {
    expect(parseFounderBrief(null).ok).toBe(false);
    expect(parseFounderBrief([valid]).ok).toBe(false);
    expect(parseFounderBrief({ ...valid, tech_stack: "React" }).ok).toBe(false);
  });
});
