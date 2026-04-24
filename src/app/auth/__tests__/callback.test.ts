import { describe, it, expect } from "vitest";
import { sanitizeNext } from "../callback/route";

describe("sanitizeNext (auth callback open-redirect guard)", () => {
  it("falls back to /dashboard for null", () => {
    expect(sanitizeNext(null)).toBe("/dashboard");
  });

  it("falls back to /dashboard for empty string", () => {
    expect(sanitizeNext("")).toBe("/dashboard");
  });

  it("accepts a simple relative path", () => {
    expect(sanitizeNext("/dashboard")).toBe("/dashboard");
    expect(sanitizeNext("/settings?tab=emails")).toBe("/settings?tab=emails");
    expect(sanitizeNext("/profile/abhi")).toBe("/profile/abhi");
  });

  it("rejects missing-slash inputs that enable subdomain takeover", () => {
    // ".evil.com" + origin would produce "https://www.vibetalent.work.evil.com"
    expect(sanitizeNext(".evil.com")).toBe("/dashboard");
    expect(sanitizeNext("dashboard")).toBe("/dashboard");
    expect(sanitizeNext("evil.com")).toBe("/dashboard");
  });

  it("rejects protocol-relative URLs", () => {
    expect(sanitizeNext("//evil.com")).toBe("/dashboard");
    expect(sanitizeNext("//evil.com/path")).toBe("/dashboard");
  });

  it("rejects backslash tricks (Windows-style paths browsers may normalize)", () => {
    expect(sanitizeNext("/\\evil.com")).toBe("/dashboard");
    expect(sanitizeNext("/path\\evil.com")).toBe("/dashboard");
  });

  it("rejects embedded control characters (CR/LF header injection)", () => {
    expect(sanitizeNext("/dashboard\r\nLocation: https://evil.com")).toBe("/dashboard");
    expect(sanitizeNext("/dashboard\nevil")).toBe("/dashboard");
    expect(sanitizeNext("/dashboard\tevil")).toBe("/dashboard");
    expect(sanitizeNext("/dashboard\x00")).toBe("/dashboard");
    expect(sanitizeNext("/dashboard\x7F")).toBe("/dashboard");
  });

  it("rejects leading whitespace or control chars", () => {
    expect(sanitizeNext(" /dashboard")).toBe("/dashboard");
    expect(sanitizeNext("\t/dashboard")).toBe("/dashboard");
    expect(sanitizeNext("\n/dashboard")).toBe("/dashboard");
  });

  it("rejects absolute https URLs", () => {
    expect(sanitizeNext("https://evil.com")).toBe("/dashboard");
    expect(sanitizeNext("http://evil.com")).toBe("/dashboard");
  });
});
