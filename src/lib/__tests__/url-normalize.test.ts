import { describe, it, expect } from "vitest";
import { normalizeExternalUrl, normalizeRepoUrl } from "../url-normalize";

describe("normalizeExternalUrl", () => {
  it("returns null for empty / nullish inputs", () => {
    expect(normalizeExternalUrl("")).toBeNull();
    expect(normalizeExternalUrl("   ")).toBeNull();
    expect(normalizeExternalUrl(null)).toBeNull();
    expect(normalizeExternalUrl(undefined)).toBeNull();
  });

  it("returns the canonical URL when already https", () => {
    expect(normalizeExternalUrl("https://example.com")).toBe("https://example.com/");
    expect(normalizeExternalUrl("https://example.com/path")).toBe(
      "https://example.com/path",
    );
  });

  it("preserves http:// when explicitly given", () => {
    expect(normalizeExternalUrl("http://example.com")).toBe("http://example.com/");
  });

  it("prepends https:// to bare-domain inputs (the SPARK bug)", () => {
    expect(normalizeExternalUrl("github.com/vibeforge1111/spark-cli")).toBe(
      "https://github.com/vibeforge1111/spark-cli",
    );
    expect(normalizeExternalUrl("example.com/path?q=1")).toBe(
      "https://example.com/path?q=1",
    );
  });

  it("handles protocol-relative inputs", () => {
    expect(normalizeExternalUrl("//example.com/x")).toBe("https://example.com/x");
  });

  it("rejects unsafe schemes", () => {
    expect(normalizeExternalUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeExternalUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(normalizeExternalUrl("file:///etc/passwd")).toBeNull();
  });

  it("rejects explicit non-http(s) schemes that would otherwise survive the prepend step", () => {
    // Without the explicit-scheme guard, prepending https:// to any of these
    // produces a string that `new URL()` parses as protocol="https:" with a
    // dotted hostname — slipping past the protocol check below.
    expect(normalizeExternalUrl("mailto:user@example.com")).toBeNull();
    expect(normalizeExternalUrl("ftp://example.com")).toBeNull();
    expect(normalizeExternalUrl("ftp://files.example.com/path")).toBeNull();
    expect(normalizeExternalUrl("tel:+1234567890")).toBeNull();
    expect(normalizeExternalUrl("ssh://user@host.example.com")).toBeNull();
    // Case-insensitivity: an upper-case scheme is rejected the same way.
    expect(normalizeExternalUrl("MAILTO:user@example.com")).toBeNull();
  });

  it("rejects inputs that don't resolve to a real host", () => {
    expect(normalizeExternalUrl("not a url")).toBeNull();
    expect(normalizeExternalUrl("http://")).toBeNull();
    // No TLD — could be a relative path mistaken for a host.
    expect(normalizeExternalUrl("localhost")).toBeNull();
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeExternalUrl("  github.com/x/y  ")).toBe("https://github.com/x/y");
  });
});

describe("normalizeRepoUrl", () => {
  it("returns null for empty inputs", () => {
    expect(normalizeRepoUrl("")).toBeNull();
    expect(normalizeRepoUrl(null)).toBeNull();
    expect(normalizeRepoUrl(undefined)).toBeNull();
  });

  it("normalizes bare-domain GitHub URLs (the original bug)", () => {
    expect(normalizeRepoUrl("github.com/vibeforge1111/spark-cli")).toBe(
      "https://github.com/vibeforge1111/spark-cli",
    );
  });

  it("normalizes www.github.com to github.com", () => {
    expect(normalizeRepoUrl("https://www.github.com/owner/repo")).toBe(
      "https://github.com/owner/repo",
    );
  });

  it("strips .git suffix", () => {
    expect(normalizeRepoUrl("https://github.com/owner/repo.git")).toBe(
      "https://github.com/owner/repo",
    );
  });

  it("strips trailing path segments and queries", () => {
    expect(
      normalizeRepoUrl("https://github.com/owner/repo/tree/main"),
    ).toBe("https://github.com/owner/repo");
  });

  it("rejects non-GitHub URLs", () => {
    expect(normalizeRepoUrl("https://gitlab.com/owner/repo")).toBeNull();
    expect(normalizeRepoUrl("https://example.com/owner/repo")).toBeNull();
  });

  it("rejects malformed input that prepending https:// can't rescue", () => {
    expect(normalizeRepoUrl("not a url")).toBeNull();
    expect(normalizeRepoUrl("github.com")).toBeNull();
    expect(normalizeRepoUrl("github.com/owner")).toBeNull();
  });
});
