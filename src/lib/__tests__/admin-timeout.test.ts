// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAdminClient } from "../supabase/admin";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("admin database requests", () => {
  it("aborts an unresponsive database instead of waiting indefinitely", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key");
    const nativeTimeout = AbortSignal.timeout.bind(AbortSignal);
    vi.spyOn(AbortSignal, "timeout").mockImplementation((ms) => {
      expect(ms).toBe(20_000);
      return nativeTimeout(20);
    });
    vi.stubGlobal("fetch", vi.fn((_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal.reason), { once: true });
    })));
    const result = await Promise.race([
      createAdminClient().from("users").select("id").limit(1),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 500)),
    ]);
    expect(result).not.toBeNull();
    expect(result?.error).toBeTruthy();
  });

  it("preserves caller cancellation", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key");
    const controller = new AbortController();
    vi.stubGlobal("fetch", vi.fn((_input, init) => new Promise((_resolve, reject) => {
      if (init?.signal?.aborted) reject(init.signal.reason);
      else init?.signal?.addEventListener("abort", () => reject(init.signal.reason), { once: true });
    })));
    const pending = createAdminClient().from("users").select("id").abortSignal(controller.signal);
    controller.abort(new Error("caller cancelled"));
    expect((await pending).error?.message).toContain("caller cancelled");
  });
});
