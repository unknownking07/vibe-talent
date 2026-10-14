// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchHeroStatsCached, fetchProofWallCached } from "@/lib/supabase/server-queries";
import { workAsyncStorage, type WorkStore } from "next/dist/server/app-render/work-async-storage.external";

const state = await vi.hoisted(async () => {
  const { AsyncLocalStorage } = await import("node:async_hooks");
  Object.assign(globalThis, { AsyncLocalStorage });
  return {
    fetcher: vi.fn(),
    cache: new Map<string, { expires: number; value: unknown }>(),
  };
});

// Use Next's installed implementation, including its nested-cache bypass and
// stale-while-revalidate behavior. Only the external cache storage is in memory.
vi.mock("next/cache", async () => import("next/dist/server/web/spec-extension/unstable-cache"));
vi.mock("@supabase/supabase-js", async importOriginal => {
  const actual = await importOriginal<typeof import("@supabase/supabase-js")>();
  return { ...actual, createClient: () => actual.createClient("https://example.supabase.co", "test-key", { global: { fetch: state.fetcher } }) };
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-14T06:00:00Z"));
  state.cache.clear();
  state.fetcher.mockReset();
  state.fetcher.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const table = new URL(String(input)).pathname.split("/").pop();
    if (init?.method === "HEAD") return new Response(null, { headers: { "content-range": `*/${table === "streak_logs" ? 21983 : 232}` } });
    if (table === "users") return Response.json([{ id: "builder", username: "builder", streak: 3, longest_streak: 10 }]);
    return Response.json([]);
  });
});
afterEach(() => vi.useRealTimers());

async function inRequest<T>(work: () => Promise<T>): Promise<T> {
  const backend = {
    generateCacheKey: async (key: string) => key,
    get: async (key: string) => {
      const entry = state.cache.get(key);
      return entry ? { value: entry.value, isStale: Date.now() >= entry.expires } : null;
    },
    set: async (key: string, value: { revalidate: number }) => {
      state.cache.set(key, { value, expires: Date.now() + value.revalidate * 1000 });
    },
  };
  const store = { route: "/", isDraftMode: false, incrementalCache: backend } as unknown as WorkStore;
  return workAsyncStorage.run(store, async () => {
    const result = await work();
    await Promise.all(Object.values(store.pendingRevalidates ?? {}));
    await Promise.all(store.pendingRevalidateWrites ?? []);
    return result;
  });
}

function activityCounts() {
  return state.fetcher.mock.calls.filter(([input, init]) =>
    new URL(String(input)).pathname.endsWith("/streak_logs") && init?.method === "HEAD");
}

describe("homepage aggregate query budget", () => {
  it("shares one exact activity count between the hero and proof wall", async () => {
    const hero = await inRequest(fetchHeroStatsCached);
    const wall = await inRequest(fetchProofWallCached);
    expect(hero.totalBuilderDays).toBe(21983);
    expect(wall.totalBuilderDays).toBe(21983);
    expect(activityCounts()).toHaveLength(1);
  });

  it("serves minute polls from cache for five minutes, then refreshes the count", async () => {
    await inRequest(fetchHeroStatsCached);
    const initialQueries = state.fetcher.mock.calls.length;
    await vi.advanceTimersByTimeAsync(120_000);
    await inRequest(fetchHeroStatsCached);
    expect(state.fetcher.mock.calls).toHaveLength(initialQueries);
    await vi.advanceTimersByTimeAsync(180_001);
    await inRequest(fetchHeroStatsCached);
    expect(activityCounts()).toHaveLength(2);
  });

  it("does not cache a failed count as zero", async () => {
    state.fetcher.mockImplementationOnce(async () => Response.json({ message: "database unavailable" }, { status: 503 }));
    await expect(inRequest(fetchHeroStatsCached)).rejects.toThrow("database unavailable");
    expect((await inRequest(fetchHeroStatsCached)).totalBuilderDays).toBe(21983);
  });
});
