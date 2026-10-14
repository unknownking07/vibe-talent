// @vitest-environment node
import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../route";

const mocks = vi.hoisted(() => ({ admin: vi.fn(), heatmap: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/github-contributions", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/github-contributions")>(),
  fetchGitHubContributions: mocks.heatmap,
}));

type Activity = { activity_date: string; commit_count: number | null; source?: string };
type Write = Activity & { user_id: string };
const userId = "11111111-1111-4111-8111-111111111111";
const request = () => new NextRequest("https://www.vibetalent.work/api/cron/github-sync", {
  headers: { authorization: "Bearer test-cron" },
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-14T06:00:00Z"));
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", "test-cron");
  vi.stubEnv("GITHUB_TOKEN", "test-github-token");
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.pathname === "/user/101") return Response.json({ login: "builder", id: 101 });
    if (url.pathname.endsWith("/events/public")) return Response.json([]);
    throw new Error(`Unexpected GitHub request: ${url.pathname}`);
  }));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

function setup(contributions: Record<string, number>, existing: Activity[], fail?: "read" | "write") {
  const writes: Write[] = [];
  const reads: URL[] = [];
  let recalculations = 0;
  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const table = url.pathname.split("/").pop();
    if (table === "streak_logs") {
      if (init?.method === "POST") {
        if (fail === "write") return Response.json({ message: "write unavailable" }, { status: 503 });
        writes.push(...JSON.parse(String(init.body)));
        return Response.json(null);
      }
      reads.push(url);
      if (fail === "read") return Response.json({ message: "read unavailable" }, { status: 503 });
      return Response.json(existing);
    }
    if (table === "update_user_streak") { recalculations++; return Response.json(null); }
    if (table === "users" && init?.method !== "PATCH") {
      return Response.json([{ id: userId, username: "builder", github_username: "builder", github_id: 101, lifetime_contributions: 10 }]);
    }
    return Response.json([]);
  });
  mocks.admin.mockReturnValue(createClient("https://example.supabase.co", "test-key", { global: { fetch: fetcher } }));
  mocks.heatmap.mockResolvedValue({ contributions, total: Object.values(contributions).reduce((a, b) => a + b, 0) });
  return { writes, reads, recalculations: () => recalculations };
}

describe("GitHub sync activity writes", () => {
  it("does not rewrite an unchanged year of activity, but still recalculates today's streak", async () => {
    const existing = Array.from({ length: 365 }, (_, i) => ({
      activity_date: new Date(Date.UTC(2026, 9, 14 - i)).toISOString().slice(0, 10),
      commit_count: 3,
    }));
    const state = setup(Object.fromEntries(existing.map(day => [day.activity_date, day.commit_count])), existing);
    const body = await (await GET(request())).json();
    expect(state.writes).toEqual([]);
    expect(state.recalculations()).toBe(1);
    expect(body).toMatchObject({ synced: 1, errors: 0, activity_rows_checked: 365, activity_rows_written: 0 });
    expect(body.details[0]).toMatchObject({ dates_logged: 365, dates_written: 0 });
  });

  it("writes new days and corrected counts while leaving identical days and source markers alone", async () => {
    const state = setup({ "2026-10-12": 1, "2026-10-13": 3, "2026-10-14": 2 }, [
      { activity_date: "2026-10-12", commit_count: 1, source: "freeze" },
      { activity_date: "2026-10-13", commit_count: 5 },
    ]);
    const body = await (await GET(request())).json();
    expect(state.writes).toEqual([
      { user_id: userId, activity_date: "2026-10-13", commit_count: 3 },
      { user_id: userId, activity_date: "2026-10-14", commit_count: 2 },
    ]);
    expect(state.reads).toHaveLength(1);
    expect(state.reads[0].searchParams.get("user_id")).toBe(`eq.${userId}`);
    expect(state.reads[0].searchParams.get("activity_date")).toContain("2026-10-14");
    expect(body).toMatchObject({ activity_rows_checked: 3, activity_rows_written: 2 });
  });

  it("reports a lookup failure without falling back to rewriting the entire history", async () => {
    const state = setup({ "2026-10-14": 2 }, [], "read");
    const body = await (await GET(request())).json();
    expect(body.errors).toBe(1);
    expect(body.details[0].status).toContain("read unavailable");
    expect(state.writes).toEqual([]);
    expect(state.recalculations()).toBe(0);
  });

  it("does not recalculate from stale activity after a write failure", async () => {
    const state = setup({ "2026-10-14": 2 }, [], "write");
    expect((await (await GET(request())).json()).errors).toBe(1);
    expect(state.recalculations()).toBe(0);
  });
});
