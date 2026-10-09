import { describe, expect, it, vi } from "vitest";
import { fetchUsers } from "@/lib/supabase/queries";
import { executeAgentTool } from "../tools";

const clientState = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => clientState.db }));

type Row = Record<string, unknown>;

function database(users: Row[], projects: Row[], failProjects = false) {
  const orders: Array<{ table: string; field: string }> = [];
  const reads: Record<string, Row[]> = { users, projects, social_links: [] };
  class Query {
    private filters: Array<(row: Row) => boolean> = [];
    private start = 0;
    private end = Infinity;
    constructor(private table: string) {}
    select() { return this; }
    not(field: string, _op: string, value: unknown) {
      this.filters.push(row => row[field] !== value); return this;
    }
    eq(field: string, value: unknown) {
      this.filters.push(row => row[field] === value); return this;
    }
    in(field: string, values: unknown[]) {
      this.filters.push(row => values.includes(row[field])); return this;
    }
    order(field: string) { orders.push({ table: this.table, field }); return this; }
    range(start: number, end: number) { this.start = start; this.end = end; return this; }
    maybeSingle() {
      return this.then(({ data, error }) => ({ data: data?.[0] ?? null, error }));
    }
    then(resolve: (result: { data: Row[] | null; error: Error | null }) => unknown) {
      const error = failProjects && this.table === "projects" ? new Error("Read failed") : null;
      const data = error ? null : reads[this.table].filter(row => this.filters.every(filter => filter(row))).slice(this.start, this.end + 1);
      return Promise.resolve({ data, error }).then(resolve);
    }
  }
  return { from: (table: string) => new Query(table), orders };
}

function builder(index: number): Row {
  return { id: `user-${index}`, username: `builder${index}`, bio: null, streak: 1000, longest_streak: 1000, vibe_score: 1000000, badge_level: "diamond" };
}
function project(overrides: Row = {}): Row {
  return { id: "project", user_id: "user-200", verified: true, flagged: false, is_private: false, tech_stack: ["React"], tags: ["dashboard"], quality_metrics: { has_tests: true, has_readme: true }, live_url: null, ...overrides };
}

describe("agent hiring search", () => {
  it("finds an evidence-backed low-activity builder beyond the old 200-person cutoff", async () => {
    const users = Array.from({ length: 201 }, (_, i) => builder(i));
    users[200] = { ...users[200], vibe_score: 10, streak: 0, longest_streak: 0, badge_level: "none" };
    const db = database(users, [project()]);
    clientState.db = db;
    const clientPool = await fetchUsers();
    expect(clientPool).toHaveLength(201);
    expect(clientPool[200].username).toBe("builder200");
    const result = await executeAgentTool(db, "search_builders", JSON.stringify({ skills: ["React"] }));
    expect(result.builders?.[0].username).toBe("builder200");
    expect(result.forLLM).toMatchObject({ pool_considered: 201 });
    expect(db.orders.filter(order => order.table === "users").every(order => order.field === "id")).toBe(true);
  });

  it("pages project rows and excludes hidden and unverified work from match evidence", async () => {
    const projects = Array.from({ length: 200 }, (_, i) => project({ id: `unverified-${i}`, verified: false }));
    projects.push(project(), project({ id: "private", is_private: true }), project({ id: "flagged", flagged: true }));
    const result = await executeAgentTool(database([builder(200)], projects), "search_builders", JSON.stringify({ skills: ["React"] }));
    expect(result.builders?.[0].match_score).toBeGreaterThan(0);
    expect(result.builders?.[0].verified_projects_count).toBe(1);
  });

  it("preserves unknown live URL checks when explaining a builder's projects", async () => {
    const result = await executeAgentTool(database([builder(200)], [project({ live_url: "https://example.com", live_url_ok: null })]), "get_builder", JSON.stringify({ username: "builder200" }));
    expect(result.forLLM).toMatchObject({ top_projects: [{ live_url_reachable_at_last_check: null }] });
  });

  it("reports unavailable data instead of silently ranking missing project reads", async () => {
    const result = await executeAgentTool(database([builder(200)], [], true), "search_builders", "{}");
    expect(result.builders).toBeUndefined();
    expect(result.forLLM).toHaveProperty("error");
  });
});
