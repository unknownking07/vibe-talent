import { describe, it, expect } from "vitest";
import { enrichPromotions, filterAuthorizedPromotions, type Promotion } from "../featured-promotions";

// Minimal shape the filter cares about.
const mk = (projectId: string, promoter: string) => ({ projectId, promoter });

describe("filterAuthorizedPromotions", () => {
  it("keeps an authorized promotion", () => {
    const authorized = new Set(["p1:0xabc"]);
    expect(
      filterAuthorizedPromotions([mk("p1", "0xABC")], authorized),
    ).toHaveLength(1);
  });

  it("drops a hijack — payer not authorized for the project", () => {
    const authorized = new Set(["p1:0xowner"]);
    expect(
      filterAuthorizedPromotions([mk("p1", "0xattacker")], authorized),
    ).toHaveLength(0);
  });

  it("matches wallet addresses case-insensitively", () => {
    const authorized = new Set(["p1:0xabc"]);
    expect(
      filterAuthorizedPromotions([mk("p1", "0xAbC")], authorized),
    ).toHaveLength(1);
  });

  it("drops a promotion for an unauthorized / unknown projectId", () => {
    const authorized = new Set(["p1:0xabc"]);
    expect(
      filterAuthorizedPromotions([mk("p2", "0xabc")], authorized),
    ).toHaveLength(0);
  });

  it("hides everything when there are no authorizations", () => {
    expect(
      filterAuthorizedPromotions([mk("p1", "0xabc")], new Set()),
    ).toHaveLength(0);
  });

  it("keeps only the authorized subset from a mixed list", () => {
    const authorized = new Set(["p1:0xabc", "p3:0xdef"]);
    const result = filterAuthorizedPromotions(
      [mk("p1", "0xabc"), mk("p2", "0xbad"), mk("p3", "0xDEF")],
      authorized,
    );
    expect(result.map((p) => p.projectId).sort()).toEqual(["p1", "p3"]);
  });
});

describe("enrichPromotions", () => {
  it("renders only public, unflagged projects with a current project row", async () => {
    type Row = Record<string, unknown>;
    const projectRows: Row[] = [
      { id: "visible", user_id: "builder", title: "Visible", flagged: false, is_private: false },
      { id: "flagged", user_id: "builder", title: "Flagged", flagged: true, is_private: false },
      { id: "private", user_id: "builder", title: "Private", flagged: false, is_private: true },
    ];
    const rows: Record<string, Row[]> = {
      featured_promotions: ["visible", "flagged", "private", "deleted"].map((project_id) => ({ project_id, promoter_wallet: "0xowner", chain: "base" })),
      projects: projectRows,
      users: [{ id: "builder", username: "builder" }],
    };
    class Query {
      private filters: Array<(row: Row) => boolean> = [];
      constructor(private table: string) {}
      select() { return this; }
      in(field: string, values: unknown[]) { this.filters.push((row) => values.includes(row[field])); return this; }
      eq(field: string, value: unknown) { this.filters.push((row) => row[field] === value); return this; }
      or() { return this; }
      order() { return this; }
      then(resolve: (value: { data: Row[]; error: null }) => unknown) {
        return Promise.resolve({ data: rows[this.table].filter((row) => this.filters.every((filter) => filter(row))), error: null }).then(resolve);
      }
    }
    const client = { from: (table: string) => new Query(table) } as unknown as Parameters<typeof enrichPromotions>[1];
    const promotions: Promotion[] = ["visible", "flagged", "private", "deleted"].map((projectId, id) => ({
      id,
      projectId,
      promoter: "0xowner",
      projectName: projectId,
      expiresAt: 0,
      paidAmount: 1,
    }));

    const result = await enrichPromotions(promotions, client);

    expect(result.map((promo) => promo.projectId)).toEqual(["visible"]);
  });
});
