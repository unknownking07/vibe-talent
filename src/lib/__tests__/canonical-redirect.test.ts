import { describe, expect, it } from "vitest";
import { canonicalProductionRedirect } from "../canonical-redirect";

describe("canonical production redirects", () => {
  it.each([
    "http://www.vibetalent.work",
    "http://vibetalent.work",
    "https://vibetalent.work",
  ])("permanently redirects %s to HTTPS www in one hop", (origin) => {
    const response = canonicalProductionRedirect(
      new URL(`${origin}/hire-ai-assisted-developers?source=search&tag=ai%20coding`),
    );

    expect(response?.status).toBe(308);
    expect(response?.headers.get("location")).toBe(
      "https://www.vibetalent.work/hire-ai-assisted-developers?source=search&tag=ai%20coding",
    );
  });

  it("preserves encoded paths without double encoding", () => {
    const response = canonicalProductionRedirect(
      new URL("http://www.vibetalent.work/profile/a%2Fb?next=%2Fexplore"),
    );

    expect(response?.headers.get("location")).toBe(
      "https://www.vibetalent.work/profile/a%2Fb?next=%2Fexplore",
    );
  });

  it.each([
    "https://www.vibetalent.work/explore",
    "http://localhost:3000/explore",
    "http://127.0.0.1:3000/explore",
    "https://beta.vibetalent.work/explore",
    "https://vibetalent.example.workers.dev/explore",
    "https://vibetalent.work.example.com/explore",
  ])("does not redirect canonical, development, or other hosts: %s", (url) => {
    expect(canonicalProductionRedirect(new URL(url))).toBeNull();
  });
});
