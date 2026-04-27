import { describe, it, expect } from "vitest";
import { normalizeSocialHandle, extractSocialHandle } from "../social-handles";

describe("normalizeSocialHandle (twitter)", () => {
  it("accepts an empty string", () => {
    expect(normalizeSocialHandle("", "twitter")).toEqual({ ok: true, handle: "" });
    expect(normalizeSocialHandle("   ", "twitter")).toEqual({ ok: true, handle: "" });
  });

  it("accepts a bare username", () => {
    expect(normalizeSocialHandle("abhinav", "twitter")).toEqual({
      ok: true,
      handle: "abhinav",
    });
  });

  it("strips a leading @", () => {
    expect(normalizeSocialHandle("@abhinav", "twitter")).toEqual({
      ok: true,
      handle: "abhinav",
    });
  });

  it("extracts username from x.com URL", () => {
    expect(normalizeSocialHandle("https://x.com/abhinav", "twitter")).toEqual({
      ok: true,
      handle: "abhinav",
    });
  });

  it("extracts username from twitter.com URL", () => {
    expect(
      normalizeSocialHandle("https://twitter.com/abhinav", "twitter")
    ).toEqual({ ok: true, handle: "abhinav" });
  });

  it("extracts username from URL without protocol", () => {
    expect(normalizeSocialHandle("x.com/abhinav", "twitter")).toEqual({
      ok: true,
      handle: "abhinav",
    });
  });

  it("strips www and accepts subdomains like mobile.twitter.com", () => {
    expect(
      normalizeSocialHandle("https://www.x.com/abhinav", "twitter")
    ).toEqual({ ok: true, handle: "abhinav" });
    expect(
      normalizeSocialHandle("https://mobile.twitter.com/abhinav", "twitter")
    ).toEqual({ ok: true, handle: "abhinav" });
  });

  it("strips trailing slashes, query strings, and fragments", () => {
    expect(
      normalizeSocialHandle("https://x.com/abhinav/", "twitter")
    ).toEqual({ ok: true, handle: "abhinav" });
    expect(
      normalizeSocialHandle("https://x.com/abhinav?ref=foo", "twitter")
    ).toEqual({ ok: true, handle: "abhinav" });
    expect(
      normalizeSocialHandle("https://x.com/abhinav#bio", "twitter")
    ).toEqual({ ok: true, handle: "abhinav" });
  });

  it("rejects random URLs", () => {
    const r = normalizeSocialHandle("https://google.com/abhinav", "twitter");
    expect(r.ok).toBe(false);
  });

  it("rejects a domain that merely ends with the platform name", () => {
    const r = normalizeSocialHandle("https://fake-x.com/abhinav", "twitter");
    expect(r.ok).toBe(false);
  });

  it("rejects a handle with invalid characters", () => {
    const r = normalizeSocialHandle("abhinav.eth", "twitter");
    expect(r.ok).toBe(false);
  });

  it("rejects a handle longer than the platform limit", () => {
    const r = normalizeSocialHandle("a".repeat(16), "twitter");
    expect(r.ok).toBe(false);
  });

  it("rejects multi-segment paths like status permalinks", () => {
    expect(
      normalizeSocialHandle("https://x.com/abhinav/status/123", "twitter").ok
    ).toBe(false);
  });

  it("rejects Twitter reserved first-segment paths", () => {
    for (const url of [
      "https://x.com/home",
      "https://x.com/explore",
      "https://x.com/i/communities/123",
      "https://x.com/intent/tweet",
      "https://x.com/search?q=foo",
      "https://x.com/login",
    ]) {
      expect(normalizeSocialHandle(url, "twitter").ok).toBe(false);
    }
  });

  it("treats a bare domain (no path) as a URL and rejects it", () => {
    expect(normalizeSocialHandle("x.com", "twitter").ok).toBe(false);
  });

  it("accepts null and undefined as empty input", () => {
    expect(normalizeSocialHandle(null, "twitter")).toEqual({ ok: true, handle: "" });
    expect(normalizeSocialHandle(undefined, "twitter")).toEqual({ ok: true, handle: "" });
  });
});

describe("normalizeSocialHandle (telegram)", () => {
  it("accepts a bare username", () => {
    expect(normalizeSocialHandle("unknownking7", "telegram")).toEqual({
      ok: true,
      handle: "unknownking7",
    });
  });

  it("extracts username from t.me URL", () => {
    expect(
      normalizeSocialHandle("https://t.me/unknownking7", "telegram")
    ).toEqual({ ok: true, handle: "unknownking7" });
  });

  it("extracts username from telegram.me URL", () => {
    expect(
      normalizeSocialHandle("https://telegram.me/unknownking7", "telegram")
    ).toEqual({ ok: true, handle: "unknownking7" });
  });

  it("extracts username from t.me URL without protocol", () => {
    expect(normalizeSocialHandle("t.me/unknownking7", "telegram")).toEqual({
      ok: true,
      handle: "unknownking7",
    });
  });

  it("rejects a Twitter URL on the telegram field", () => {
    const r = normalizeSocialHandle(
      "https://x.com/unknownking7",
      "telegram"
    );
    expect(r.ok).toBe(false);
  });

  it("rejects a Telegram invite link with non-handle characters", () => {
    const r = normalizeSocialHandle(
      "https://t.me/+abc123def456",
      "telegram"
    );
    expect(r.ok).toBe(false);
  });

  it("rejects legacy joinchat invite links", () => {
    expect(
      normalizeSocialHandle("https://t.me/joinchat/AAAAAAAAAAAAAAAAAA", "telegram").ok
    ).toBe(false);
  });

  it("rejects Telegram reserved first-segment paths", () => {
    for (const url of [
      "https://t.me/share/url?url=foo",
      "https://t.me/addstickers/somepack",
      "https://t.me/c/123/456",
    ]) {
      expect(normalizeSocialHandle(url, "telegram").ok).toBe(false);
    }
  });

  it("allows a 32-char handle and rejects 33", () => {
    expect(
      normalizeSocialHandle("a".repeat(32), "telegram").ok
    ).toBe(true);
    expect(
      normalizeSocialHandle("a".repeat(33), "telegram").ok
    ).toBe(false);
  });
});

describe("extractSocialHandle (lenient read path)", () => {
  it("returns null for empty/null/undefined input", () => {
    expect(extractSocialHandle("", "twitter")).toBe(null);
    expect(extractSocialHandle(null, "twitter")).toBe(null);
    expect(extractSocialHandle(undefined, "twitter")).toBe(null);
  });

  it("returns the handle for a bare username", () => {
    expect(extractSocialHandle("abhinav", "twitter")).toBe("abhinav");
  });

  it("extracts handle from a full URL stored in legacy data", () => {
    expect(extractSocialHandle("https://x.com/abhinav", "twitter")).toBe("abhinav");
    expect(extractSocialHandle("https://t.me/abhinav", "telegram")).toBe("abhinav");
  });

  it("returns null for unparseable values so render sites omit the link", () => {
    expect(extractSocialHandle("https://google.com/abhinav", "twitter")).toBe(null);
    expect(extractSocialHandle("not a handle!", "twitter")).toBe(null);
  });
});
