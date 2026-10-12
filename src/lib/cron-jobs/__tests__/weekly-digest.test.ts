// @vitest-environment node
import { createClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runWeeklyDigest } from "../weekly-digest";

const mocks = vi.hoisted(() => ({ admin: vi.fn(), notify: vi.fn(), send: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/notifications", () => ({ createNotification: mocks.notify }));
vi.mock("@/lib/email", () => ({ sendWeeklyDigestEmail: mocks.send }));
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-12T15:00:00Z"));
  vi.clearAllMocks();
  mocks.notify.mockResolvedValue(undefined);
  mocks.send.mockResolvedValue(undefined);
});
afterEach(() => vi.useRealTimers());

function setup(sentToday = 0, failTable?: string, failLog = false) {
  const writes: unknown[] = [];
  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const table = url.pathname.split("/").pop();
    if (table === failTable || (failLog && table === "email_log" && init?.method === "POST")) {
      return Response.json({ message: "database unavailable" }, { status: 503 });
    }
    if (table === "email_log" && init?.method === "HEAD") {
      return new Response(null, { headers: { "content-range": `*/${sentToday}` } });
    }
    if (init?.method === "POST") {
      if (table === "email_log") writes.push(JSON.parse(String(init.body)));
      return Response.json(null);
    }
    if (table === "users") return Response.json([1, 2, 3].map(id => ({ id: `user-${id}`, username: `builder${id}`, streak: 0, vibe_score: 10 })));
    return Response.json([]);
  });
  const client = createClient("https://example.supabase.co", "test-key", { global: { fetch: fetcher } });
  client.auth.admin.getUserById = vi.fn().mockImplementation(async id => ({ data: { user: { id, email: `${id}@example.com` } }, error: null }));
  mocks.admin.mockReturnValue(client);
  return { writes, fetcher };
}

describe("weekly digest delivery accounting", () => {
  it("shares the daily email allowance with earlier runs", async () => {
    const state = setup(89);
    expect(await runWeeklyDigest()).toMatchObject({ emailed: 1, notified: 3 });
    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(state.writes).toHaveLength(1);
  });
  it("does not send more emails when today's allowance is exhausted", async () => {
    setup(90);
    expect((await runWeeklyDigest()).emailed).toBe(0);
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("paces provider sends to leave room for transactional traffic", async () => {
    setup();
    const result = runWeeklyDigest();
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.send).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(200);
    expect(mocks.send).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(200);
    expect(mocks.send).toHaveBeenCalledTimes(3);
    expect((await result).emailed).toBe(3);
  });
  it.each(["users", "profile_views", "hire_requests", "projects", "email_preferences", "email_log", "notifications"])("fails closed when %s cannot be read", async table => {
    setup(0, table);
    await expect(runWeeklyDigest()).rejects.toThrow("database unavailable");
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("does not record a failed provider send as delivered", async () => {
    const state = setup();
    mocks.send.mockRejectedValueOnce(new Error("daily quota exceeded"));
    await expect(runWeeklyDigest()).rejects.toThrow("daily quota exceeded");
    expect(state.writes).toHaveLength(0);
  });
  it("reports an email receipt write failure", async () => {
    setup(0, undefined, true);
    await expect(runWeeklyDigest()).rejects.toThrow("database unavailable");
  });
});
