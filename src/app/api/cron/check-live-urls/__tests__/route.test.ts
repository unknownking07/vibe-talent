// @vitest-environment node
import { createClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../route";
const mocks = vi.hoisted(() => ({ admin: vi.fn(), checkLiveUrl: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/github-quality", () => ({ checkLiveUrl: mocks.checkLiveUrl }));
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe("live URL cron evidence", () => {
  it("reports failed database writes to the scheduler", async () => {
    vi.stubEnv("CRON_SECRET", "test-cron");
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
      init?.method === "PATCH"
        ? Response.json({ message: "database unavailable" }, { status: 503 })
        : Response.json([{ id: "project", live_url: "https://example.com" }])
    );
    mocks.admin.mockReturnValue(createClient("https://example.supabase.co", "test-key", { global: { fetch: fetcher } }));
    mocks.checkLiveUrl.mockResolvedValue(true);
    const response = await GET(new NextRequest("https://example.com/api/cron/check-live-urls", { headers: { authorization: "Bearer test-cron" } }));
    expect(response.status).toBe(503);
    expect((await response.json()).errors).toBe(1);
  });
  it("cannot restore health for a URL edited while the old URL was being checked", async () => {
    vi.stubEnv("CRON_SECRET", "test-cron");
    let stored = { id: "project", live_url: "https://old.example.com", live_url_ok: false };
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      if (init?.method !== "PATCH") return Response.json([{ ...stored }]);
      if (url.searchParams.get("live_url") === `eq.${stored.live_url}`) {
        stored = { ...stored, ...JSON.parse(String(init.body)) };
        return Response.json([{ id: stored.id }]);
      }
      if (!url.searchParams.has("live_url")) stored.live_url_ok = true;
      return Response.json([]);
    });
    mocks.admin.mockReturnValue(createClient("https://example.supabase.co", "test-key", { global: { fetch: fetcher } }));
    mocks.checkLiveUrl.mockImplementation(async () => {
      stored = { ...stored, live_url: "https://new.example.com", live_url_ok: false };
      return true;
    });
    const response = await GET(new NextRequest("https://example.com/api/cron/check-live-urls", { headers: { authorization: "Bearer test-cron" } }));
    expect(stored.live_url_ok).toBe(false);
    expect((await response.json()).checked).toBe(0);
  });
});
