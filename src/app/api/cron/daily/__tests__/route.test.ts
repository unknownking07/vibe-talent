// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../route";

const mocks = vi.hoisted(() => ({ bindingFetch: vi.fn(), calibration: vi.fn() }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: () => ({ env: { WORKER_SELF_REFERENCE: { fetch: mocks.bindingFetch } } }) }));
vi.mock("@/lib/seo", () => ({ getSiteUrl: () => "https://www.vibetalent.work" }));
vi.mock("@/lib/cron-jobs/reviewer-calibration", () => ({ runReviewerCalibration: mocks.calibration }));
const req = () => new NextRequest("https://www.vibetalent.work/api/cron/daily", { headers: { authorization: "Bearer test-cron" } });
const ok = () => Response.json({ updated: 0 });

beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks(); vi.stubEnv("CRON_SECRET", "test-cron");
  mocks.bindingFetch.mockImplementation(async () => ok());
  mocks.calibration.mockResolvedValue({ updated: 0, skipped: 0 });
  vi.stubGlobal("fetch", vi.fn(async () => ok()));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("daily cron failure reporting", () => {
  it("keeps authorization on service-binding fanout and reports success", async () => {
    const response = await GET(req());
    expect(response.status).toBe(200);
    expect(mocks.bindingFetch).toHaveBeenCalledTimes(8);
    expect(mocks.bindingFetch.mock.calls[0][1].headers.authorization).toBe("Bearer test-cron");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("returns a failure when a child fails, while completing the other jobs", async () => {
    mocks.bindingFetch.mockResolvedValueOnce(Response.json({ error: "Failed to fetch users" }, { status: 500 }));
    const response = await GET(req());
    expect(response.status).toBe(503);
    expect((await response.json()).failed_jobs).toContain("github-sync");
    expect(mocks.bindingFetch).toHaveBeenCalledTimes(8);
  });
  it("reports partial errors even when a child returns HTTP 200", async () => {
    mocks.bindingFetch.mockResolvedValueOnce(Response.json({ synced: 3, errors: 2 }));
    expect((await GET(req())).status).toBe(503);
  });
  it("does not execute the same job again through public fetch if a binding fails", async () => {
    mocks.bindingFetch.mockRejectedValueOnce(new Error("binding failed"));
    expect((await GET(req())).status).toBe(503);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("bounds a hung child and continues, even if the binding ignores AbortSignal", async () => {
    mocks.bindingFetch.mockImplementationOnce(() => new Promise(() => {}));
    let response: Response | undefined;
    void GET(req()).then(result => { response = result; });
    await vi.advanceTimersByTimeAsync(90_001);
    expect(response).toBeDefined();
    expect(response?.status).toBe(503);
    expect((await response!.json()).results["github-sync"].error).toContain("timed out");
    expect(mocks.bindingFetch).toHaveBeenCalledTimes(8);
  });
  it("bounds stalled reviewer calibration and reports it as a failure", async () => {
    mocks.calibration.mockImplementationOnce(() => new Promise(() => {}));
    let response: Response | undefined;
    void GET(req()).then(result => { response = result; });
    await vi.advanceTimersByTimeAsync(30_001);
    expect(response).toBeDefined();
    expect(response?.status).toBe(503);
  });
  it("rejects unauthorized calls before starting work", async () => {
    expect((await GET(new NextRequest("https://example.com/api/cron/daily"))).status).toBe(401);
    expect(mocks.bindingFetch).not.toHaveBeenCalled();
  });
});
