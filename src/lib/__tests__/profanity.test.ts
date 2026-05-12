import { describe, it, expect } from "vitest";
import { containsProfanity, validateDisplayName } from "../profanity";

describe("validateDisplayName", () => {
  it("accepts an empty / whitespace value (display name is optional)", () => {
    expect(validateDisplayName("")).toBeNull();
    expect(validateDisplayName("   ")).toBeNull();
  });

  it("enforces a 2-character minimum", () => {
    expect(validateDisplayName("a")).toMatch(/at least 2/);
    expect(validateDisplayName(" b ")).toMatch(/at least 2/);
  });

  it("enforces a 30-character maximum", () => {
    expect(validateDisplayName("a".repeat(30))).toBeNull();
    expect(validateDisplayName("a".repeat(31))).toMatch(/30 characters or less/);
  });

  it("accepts names with digits — the original regression that motivated the relaxed contract", () => {
    expect(validateDisplayName("25TH")).toBeNull();
    expect(validateDisplayName("Bob123")).toBeNull();
    expect(validateDisplayName("h3llo")).toBeNull();
    expect(validateDisplayName("12345")).toBeNull();
  });

  it("accepts vowel-less ASCII names that the old gibberish heuristic rejected", () => {
    expect(validateDisplayName("xyz")).toBeNull();
    expect(validateDisplayName("Mr T")).toBeNull();
    expect(validateDisplayName("JFK")).toBeNull();
  });

  it("accepts non-Latin scripts and emoji", () => {
    expect(validateDisplayName("ニック")).toBeNull();
    expect(validateDisplayName("🚀rocket")).toBeNull();
    expect(validateDisplayName("北京")).toBeNull();
  });

  it("still blocks profanity", () => {
    expect(validateDisplayName("shit head")).toMatch(/inappropriate language/);
    expect(validateDisplayName("fuck off")).toMatch(/inappropriate language/);
  });

  it("blocks profanity disguised with leet character substitutions", () => {
    // containsProfanity normalizes 0→o, 1→i, 3→e, 4→a, 5→s, @→a, $→s before
    // matching. Separator-based evasion ("f.u.c.k") is *not* caught — the
    // normalizer collapses dots/dashes/underscores to spaces, which splits
    // the letters into separate words. That's a known gap; see profanity.ts.
    expect(validateDisplayName("sh1t")).toMatch(/inappropriate language/);
    expect(validateDisplayName("$hit")).toMatch(/inappropriate language/);
    expect(validateDisplayName("@ss")).toMatch(/inappropriate language/);
  });
});

describe("containsProfanity", () => {
  it("returns false for empty input", () => {
    expect(containsProfanity("")).toBe(false);
  });

  it("does not false-positive on legitimate words that contain banned substrings", () => {
    // Word-boundary matching exists specifically so "class" / "assassin" /
    // "Cassandra" don't get flagged for embedding "ass".
    expect(containsProfanity("Cassandra")).toBe(false);
    expect(containsProfanity("classroom")).toBe(false);
    expect(containsProfanity("assassin")).toBe(false);
  });

  it("flags whole-word matches regardless of case", () => {
    expect(containsProfanity("SHIT")).toBe(true);
    expect(containsProfanity("Fuck this")).toBe(true);
  });
});
