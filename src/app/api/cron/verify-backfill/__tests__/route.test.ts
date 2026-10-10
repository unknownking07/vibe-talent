// @vitest-environment node
import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "../route";

const mocks = vi.hoisted(() => ({ admin: vi.fn(), analyze: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/github-quality", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/github-quality")>(),
  analyzeRepository: mocks.analyze,
}));
vi.mock("@/lib/github-identity", () => ({ readGithubIdentity: () => ({ id: 1, username: "alice" }) }));
vi.mock("@/lib/notifications", () => ({ createNotification: vi.fn() }));
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

const candidate = { id: "project", user_id: "owner", github_url: "https://github.com/alice/app", live_url: null, title: "App", verified: false };
function setup(errorCode: string, patchFails = false, repoEdited = false) {
  vi.stubEnv("CRON_SECRET", "test-cron");
  const patches: URL[] = [];
  let stamped = false;
  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (init?.method === "PATCH") {
      patches.push(url);
      if (patchFails) return Response.json({ message: "database unavailable" }, { status: 503 });
      const currentRepo = repoEdited ? "https://github.com/alice/new" : candidate.github_url;
      if (!url.searchParams.has("github_url") || url.searchParams.get("github_url") === `eq.${currentRepo}`) stamped = true;
      return Response.json([]);
    }
    if (url.pathname.endsWith("/users")) return Response.json([{ id: "owner", github_username: "alice", username: "alice" }]);
    return Response.json([candidate]);
  });
  const client = createClient("https://example.supabase.co", "test-key", { global: { fetch: fetcher } });
  client.auth.admin.getUserById = vi.fn().mockResolvedValue({ data: { user: { id: "owner" } }, error: null });
  mocks.admin.mockReturnValue(client);
  mocks.analyze.mockResolvedValue({ success: false, metrics: null, error: "Unavailable", errorCode });
  return { patches, isStamped: () => stamped };
}
async function run() {
  const response = await GET(new NextRequest("https://example.com/api/cron/verify-backfill", { headers: { authorization: "Bearer test-cron" } }));
  return response.json();
}

describe("verification backfill failure classification", () => {
  it.each(["not_found", "needs_repo_scope"])("skips inaccessible repositories (%s) with a later retry", async (code) => {
    const state = setup(code);
    expect(await run()).toMatchObject({ verified: 0, skipped: 1, errors: 0 });
    expect(state.isStamped()).toBe(true);
    expect(state.patches[0].searchParams.get("user_id")).toBe("eq.owner");
    expect(state.patches[0].searchParams.get("github_url")).toBe(`eq.${candidate.github_url}`);
    expect(state.patches[0].searchParams.get("live_url")).toBe("is.null");
  });
  it.each(["rate_limited", "network_error", "unknown"])("keeps operational failures visible and eligible for retry (%s)", async (code) => {
    const state = setup(code);
    expect(await run()).toMatchObject({ verified: 0, skipped: 0, errors: 1 });
    expect(state.patches).toHaveLength(0);
  });
  it("reports a failed retry timestamp write as an operational error", async () => {
    setup("not_found", true);
    expect((await run()).errors).toBe(1);
  });
  it("cannot postpone rechecking a repository edited during analysis", async () => {
    const state = setup("not_found", false, true);
    await run();
    expect(state.isStamped()).toBe(false);
  });
});
