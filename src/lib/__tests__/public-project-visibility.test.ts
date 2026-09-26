import { describe, expect, it, vi } from "vitest";
import {
  fetchAllProjectsCached,
  fetchAllUsersCached,
  fetchHeroStatsCached,
  fetchHomepageDataCached,
  fetchUserByUsernameCached,
} from "@/lib/supabase/server-queries";

type Row = Record<string, unknown>;
const rows: Record<string, Row[]> = {
  users: [{ id: "builder-1", username: "builder", vibe_score: 50, streak: 2, longest_streak: 2 }],
  projects: [
    { id: "visible", user_id: "builder-1", is_private: false, flagged: false, live_url: "https://example.com", created_at: "2026-09-19" },
    { id: "flagged", user_id: "builder-1", is_private: false, flagged: true, live_url: "https://example.com", created_at: "2026-09-18" },
    { id: "private", user_id: "builder-1", is_private: true, flagged: false, live_url: "https://example.com", created_at: "2026-09-17" },
  ],
  social_links: [],
  streak_logs: [],
};

class Query {
  private filters: Array<(row: Row) => boolean> = [];
  private relationFilters: Array<(row: Row) => boolean> = [];
  private options: { count?: string; head?: boolean } = {};
  private maxRows = Infinity;
  private fields = "";

  constructor(private table: string) {}

  select(fields: string, options?: { count?: string; head?: boolean }) {
    this.fields = fields;
    this.options = options ?? {};
    return this;
  }
  eq(field: string, value: unknown) {
    if (field.startsWith("projects.")) {
      this.relationFilters.push((row) => row[field.slice("projects.".length)] === value);
    } else {
      this.filters.push((row) => row[field] === value);
    }
    return this;
  }
  not(field: string, _operator: string, value: unknown) {
    this.filters.push((row) => row[field] !== value);
    return this;
  }
  in(field: string, values: unknown[]) {
    this.filters.push((row) => values.includes(row[field]));
    return this;
  }
  order() { return this; }
  limit(count: number) { this.maxRows = count; return this; }

  private result() {
    const matching = (rows[this.table] ?? []).filter((row) => this.filters.every((filter) => filter(row)));
    const data = matching.slice(0, this.maxRows).map((row) => {
      if (this.table !== "users" || !this.fields.includes("projects!")) return row;
      return {
        ...row,
        projects: rows.projects.filter((project) =>
          project.user_id === row.id && this.relationFilters.every((filter) => filter(project))),
        social_links: rows.social_links.find((social) => social.user_id === row.id) ?? null,
      };
    });
    return {
      data: this.options.head ? null : data,
      count: this.options.count ? matching.length : null,
      error: null,
    };
  }
  single() {
    return Promise.resolve({ data: this.result().data?.[0] ?? null, error: null });
  }
  then(resolve: (value: ReturnType<Query["result"]>) => unknown, reject?: (error: unknown) => unknown) {
    return Promise.resolve(this.result()).then(resolve, reject);
  }
}

vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from: (table: string) => new Query(table) }),
}));

describe("public project visibility", () => {
  it("omits flagged projects from every public surface and its counts", async () => {
    const [listing, builders, profile, homepage, hero] = await Promise.all([
      fetchAllProjectsCached(),
      fetchAllUsersCached(),
      fetchUserByUsernameCached("builder"),
      fetchHomepageDataCached(),
      fetchHeroStatsCached(),
    ]);

    expect(listing.map((project: { id: string }) => project.id)).toEqual(["visible"]);
    expect(builders[0].projects?.map((project) => project.id)).toEqual(["visible"]);
    expect(profile?.projects?.map((project) => project.id)).toEqual(["visible"]);
    expect(homepage.featuredProjects.map((project: { id: string }) => project.id)).toEqual(["visible"]);
    expect(homepage.topVibecoders[0].projects?.map((project) => project.id)).toEqual(["visible"]);
    expect(homepage.totalProjects).toBe(1);
    expect(hero.totalProjects).toBe(1);
  });
});
