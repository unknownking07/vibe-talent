import { describe, it, expect } from "vitest";
import { filterAuthorizedPromotions } from "../featured-promotions";

// Minimal shape the filter cares about.
const mk = (projectId: string, promoter: string) => ({ projectId, promoter });

describe("filterAuthorizedPromotions", () => {
  it("keeps an authorized promotion", () => {
    const authorized = new Set(["p1:0xabc"]);
    expect(filterAuthorizedPromotions([mk("p1", "0xABC")], authorized)).toHaveLength(1);
  });

  it("drops a hijack — payer not authorized for the project", () => {
    const authorized = new Set(["p1:0xowner"]);
    expect(filterAuthorizedPromotions([mk("p1", "0xattacker")], authorized)).toHaveLength(0);
  });

  it("matches wallet addresses case-insensitively", () => {
    const authorized = new Set(["p1:0xabc"]);
    expect(filterAuthorizedPromotions([mk("p1", "0xAbC")], authorized)).toHaveLength(1);
  });

  it("drops a promotion for an unauthorized / unknown projectId", () => {
    const authorized = new Set(["p1:0xabc"]);
    expect(filterAuthorizedPromotions([mk("p2", "0xabc")], authorized)).toHaveLength(0);
  });

  it("hides everything when there are no authorizations", () => {
    expect(filterAuthorizedPromotions([mk("p1", "0xabc")], new Set())).toHaveLength(0);
  });

  it("keeps only the authorized subset from a mixed list", () => {
    const authorized = new Set(["p1:0xabc", "p3:0xdef"]);
    const result = filterAuthorizedPromotions(
      [mk("p1", "0xabc"), mk("p2", "0xbad"), mk("p3", "0xDEF")],
      authorized
    );
    expect(result.map((p) => p.projectId).sort()).toEqual(["p1", "p3"]);
  });
});
