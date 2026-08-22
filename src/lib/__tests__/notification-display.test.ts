import { describe, it, expect } from "vitest";
import {
  notificationTimeAgo,
  extractNotificationLink,
  parseNotificationMessage,
} from "../notification-display";

describe("notificationTimeAgo", () => {
  it("returns an empty string for unparseable input rather than 'undefined'", () => {
    // Pre-fix the function silently returned `undefined` for these because
    // NaN comparisons fell through every branch.
    expect(notificationTimeAgo("not a date")).toBe("");
    expect(notificationTimeAgo("")).toBe("");
  });

  it("clamps future timestamps to 'just now' (clock skew tolerance)", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(notificationTimeAgo(future)).toBe("just now");
  });

  it("formats minutes, hours, and days against a recent timestamp", () => {
    const now = Date.now();
    expect(notificationTimeAgo(new Date(now - 5_000).toISOString())).toBe(
      "just now",
    );
    expect(notificationTimeAgo(new Date(now - 5 * 60_000).toISOString())).toBe(
      "5m ago",
    );
    expect(
      notificationTimeAgo(new Date(now - 3 * 3600_000).toISOString()),
    ).toBe("3h ago");
    expect(
      notificationTimeAgo(new Date(now - 2 * 86400_000).toISOString()),
    ).toBe("2d ago");
  });
});

describe("extractNotificationLink", () => {
  it("returns null for missing or empty metadata", () => {
    expect(extractNotificationLink(null)).toBeNull();
    expect(extractNotificationLink(undefined)).toBeNull();
    expect(extractNotificationLink({})).toBeNull();
    expect(extractNotificationLink({ link: "" })).toBeNull();
    expect(extractNotificationLink({ link: 42 })).toBeNull();
  });

  it("accepts same-origin paths", () => {
    expect(extractNotificationLink({ link: "/dashboard" })).toBe("/dashboard");
    expect(extractNotificationLink({ link: "/projects/abc?ref=x" })).toBe(
      "/projects/abc?ref=x",
    );
  });

  it("accepts absolute http and https URLs", () => {
    expect(extractNotificationLink({ link: "https://example.com/x" })).toBe(
      "https://example.com/x",
    );
    expect(extractNotificationLink({ link: "http://example.com/x" })).toBe(
      "http://example.com/x",
    );
  });

  it("rejects javascript:, data:, and other dangerous schemes", () => {
    expect(extractNotificationLink({ link: "javascript:alert(1)" })).toBeNull();
    expect(extractNotificationLink({ link: "JaVaScRiPt:alert(1)" })).toBeNull();
    expect(
      extractNotificationLink({
        link: "data:text/html,<script>alert(1)</script>",
      }),
    ).toBeNull();
    expect(extractNotificationLink({ link: "vbscript:msgbox(1)" })).toBeNull();
    expect(extractNotificationLink({ link: "file:///etc/passwd" })).toBeNull();
  });

  it("rejects protocol-relative and backslash-trick URLs", () => {
    expect(extractNotificationLink({ link: "//evil.com" })).toBeNull();
    expect(extractNotificationLink({ link: "/\\evil.com" })).toBeNull();
    expect(
      extractNotificationLink({ link: "/path\\with\\backslashes" }),
    ).toBeNull();
  });

  it("rejects garbage that is neither a path nor a parseable URL", () => {
    expect(extractNotificationLink({ link: "not a url" })).toBeNull();
    expect(extractNotificationLink({ link: "evil.com/x" })).toBeNull();
  });
});

describe("parseNotificationMessage", () => {
  it("links a mention and keeps the surrounding text", () => {
    expect(parseNotificationMessage("@zarkonik viewed your profile")).toEqual([
      { type: "mention", username: "zarkonik" },
      { type: "text", value: " viewed your profile" },
    ]);
  });

  it("handles several mentions in one message", () => {
    expect(parseNotificationMessage("@ana and @bob-1 endorsed you")).toEqual([
      { type: "mention", username: "ana" },
      { type: "text", value: " and " },
      { type: "mention", username: "bob-1" },
      { type: "text", value: " endorsed you" },
    ]);
  });

  it("does not tear apart an email address", () => {
    const parsed = parseNotificationMessage("reply to bob@example.com soon");
    expect(parsed).toEqual([
      { type: "text", value: "reply to bob@example.com soon" },
    ]);
  });

  it("returns plain text when there is no mention", () => {
    expect(parseNotificationMessage("Your streak hit 30 days")).toEqual([
      { type: "text", value: "Your streak hit 30 days" },
    ]);
  });

  it("returns nothing for an empty message", () => {
    expect(parseNotificationMessage("")).toEqual([]);
  });
});
