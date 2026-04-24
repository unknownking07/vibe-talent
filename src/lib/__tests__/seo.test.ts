import { describe, it, expect, afterEach } from "vitest";
import { getSiteUrl, siteUrl, buildBreadcrumbList } from "../seo";

const ORIGINAL_ENV = process.env.NEXT_PUBLIC_SITE_URL;

afterEach(() => {
  if (ORIGINAL_ENV === undefined) {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  } else {
    process.env.NEXT_PUBLIC_SITE_URL = ORIGINAL_ENV;
  }
});

describe("getSiteUrl", () => {
  it("falls back to canonical siteUrl when env is unset", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(getSiteUrl()).toBe(siteUrl);
  });

  it("falls back for empty string", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "";
    expect(getSiteUrl()).toBe(siteUrl);
  });

  it("falls back for whitespace-only string", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "   ";
    expect(getSiteUrl()).toBe(siteUrl);
  });

  it("falls back for non-URL garbage", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "not-a-url";
    expect(getSiteUrl()).toBe(siteUrl);
  });

  it("falls back for non-http(s) protocols (ftp, javascript, file)", () => {
    for (const bad of ["ftp://example.com", "javascript:alert(1)", "file:///etc/passwd"]) {
      process.env.NEXT_PUBLIC_SITE_URL = bad;
      expect(getSiteUrl()).toBe(siteUrl);
    }
  });

  it("accepts a valid https URL and returns origin unchanged", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://staging.example.com";
    expect(getSiteUrl()).toBe("https://staging.example.com");
  });

  it("strips trailing slash via .origin", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://staging.example.com/";
    expect(getSiteUrl()).toBe("https://staging.example.com");
  });

  it("strips embedded path via .origin", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://staging.example.com/some/path";
    expect(getSiteUrl()).toBe("https://staging.example.com");
  });

  it("accepts http URLs for local dev", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
    expect(getSiteUrl()).toBe("http://localhost:3000");
  });

  it("trims surrounding whitespace before parsing", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "  https://staging.example.com  ";
    expect(getSiteUrl()).toBe("https://staging.example.com");
  });
});

describe("buildBreadcrumbList", () => {
  it("builds a standalone BreadcrumbList with siteUrl for path '/'", () => {
    const result = buildBreadcrumbList([
      { name: "Home", path: "/" },
      { name: "Privacy Policy", path: "/privacy" },
    ]);

    expect(result).toEqual({
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
        { "@type": "ListItem", position: 2, name: "Privacy Policy", item: `${siteUrl}/privacy` },
      ],
    });
  });

  it("positions items starting from 1 in order", () => {
    const result = buildBreadcrumbList([
      { name: "A", path: "/a" },
      { name: "B", path: "/b" },
      { name: "C", path: "/c" },
    ]);

    expect(result.itemListElement.map((i) => i.position)).toEqual([1, 2, 3]);
  });

  it("returns an empty itemListElement array for empty input", () => {
    expect(buildBreadcrumbList([]).itemListElement).toEqual([]);
  });

  it("prepends a leading slash when a caller passes path without one", () => {
    const result = buildBreadcrumbList([{ name: "Privacy", path: "privacy" }]);
    expect(result.itemListElement[0].item).toBe(`${siteUrl}/privacy`);
  });

  it("treats empty path as root siteUrl", () => {
    const result = buildBreadcrumbList([{ name: "Home", path: "" }]);
    expect(result.itemListElement[0].item).toBe(siteUrl);
  });

  it("trims surrounding whitespace in path", () => {
    const result = buildBreadcrumbList([{ name: "Privacy", path: "  /privacy  " }]);
    expect(result.itemListElement[0].item).toBe(`${siteUrl}/privacy`);
  });
});
