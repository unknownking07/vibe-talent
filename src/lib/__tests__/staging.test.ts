import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// getCloudflareContext throws outside the Workers runtime, which is exactly the
// local-dev path we want to exercise. Stub it so each case controls the env.
const getCloudflareContext = vi.hoisted(() => vi.fn());
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext }));

import { isStaging, stagingOnlyResponse } from "../staging";

const ORIGINAL = process.env.VIBE_STAGING;

beforeEach(() => {
  vi.resetModules();
  getCloudflareContext.mockReset();
  delete process.env.VIBE_STAGING;
});

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.VIBE_STAGING;
  else process.env.VIBE_STAGING = ORIGINAL;
});

describe("isStaging", () => {
  it("is true when the Worker sets IS_STAGING=1", () => {
    getCloudflareContext.mockReturnValue({ env: { IS_STAGING: "1" } });
    expect(isStaging()).toBe(true);
  });

  it("is false on the production Worker, where the var is absent", () => {
    getCloudflareContext.mockReturnValue({ env: {} });
    expect(isStaging()).toBe(false);
  });

  it("fails CLOSED for any value other than exactly '1'", () => {
    // Wrongly returning true would expose unreleased paid flows on the live
    // site, so anything ambiguous must read as production.
    for (const v of ["0", "true", "yes", "", "01", " 1"]) {
      getCloudflareContext.mockReturnValue({ env: { IS_STAGING: v } });
      expect(isStaging(), `IS_STAGING=${JSON.stringify(v)}`).toBe(false);
    }
  });

  it("falls back to VIBE_STAGING when not running on Cloudflare", () => {
    getCloudflareContext.mockImplementation(() => {
      throw new Error("not in a Workers context");
    });
    expect(isStaging()).toBe(false);
    process.env.VIBE_STAGING = "1";
    expect(isStaging()).toBe(true);
  });

  it("is false when the context throws and no local override is set", () => {
    getCloudflareContext.mockImplementation(() => {
      throw new Error("not in a Workers context");
    });
    expect(isStaging()).toBe(false);
  });
});

describe("stagingOnlyResponse", () => {
  it("returns null on staging so the handler proceeds", () => {
    getCloudflareContext.mockReturnValue({ env: { IS_STAGING: "1" } });
    expect(stagingOnlyResponse()).toBeNull();
  });

  it("returns 404 — not 403 — in production", async () => {
    // 403 would confirm the endpoint exists; 404 gives nothing away.
    getCloudflareContext.mockReturnValue({ env: {} });
    const res = stagingOnlyResponse();
    expect(res).not.toBeNull();
    expect(res!.status).toBe(404);
    await expect(res!.json()).resolves.toEqual({ error: "Not found" });
  });
});
