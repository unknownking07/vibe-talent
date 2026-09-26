import { afterEach, describe, expect, it, vi } from "vitest";
import type { IncrementalCache } from "@opennextjs/aws/types/overrides";

const pending = vi.hoisted(() => ({ tasks: [] as Promise<unknown>[] }));
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => ({
    ctx: { waitUntil: (task: Promise<unknown>) => { pending.tasks.push(task); } },
  }),
}));

import { withPublicStaleCache } from "@/lib/cloudflare/public-stale-cache";

function setup() {
  const entries = new Map<string, Response>();
  const cache = {
    match: vi.fn(async (key: string) => entries.get(key)?.clone()),
    put: vi.fn(async (key: string, response: Response) => {
      entries.set(key, response.clone());
    }),
    delete: vi.fn(async (key: string) => entries.delete(key)),
  };
  vi.stubGlobal("caches", { open: vi.fn(async () => cache) });
  const base = {
    name: "regional-test",
    get: vi.fn(),
    set: vi.fn(async () => {}),
    delete: vi.fn(async () => {}),
  };
  return { cache, base, wrapped: withPublicStaleCache(base as unknown as IncrementalCache) };
}

async function finishBackground() {
  await Promise.allSettled(pending.tasks.splice(0));
}

afterEach(() => {
  vi.unstubAllGlobals();
  pending.tasks.length = 0;
});

describe("public regional stale cache", () => {
  it("returns a saved public profile while the underlying cache read is pending", async () => {
    const { cache, base, wrapped } = setup();
    const entry = { value: { kind: "APP_PAGE", html: "public profile" }, lastModified: 100 };
    base.get.mockResolvedValueOnce(entry);

    expect(await wrapped.get("/profile/alice")).toEqual(entry);
    await finishBackground();
    expect(cache.put).toHaveBeenCalledOnce();
    expect([...cache.put.mock.calls[0][1].headers].find(([name]) => name === "cache-control")?.[1])
      .toBe("public, max-age=86400");

    let finishRead!: (value: typeof entry) => void;
    base.get.mockImplementationOnce(() => new Promise((resolve) => { finishRead = resolve; }));
    await expect(wrapped.get("/profile/alice")).resolves.toEqual(entry);
    expect(pending.tasks).toHaveLength(1);
    finishRead(entry);
    await finishBackground();
  });

  it("does not retain protected or personalized entries", async () => {
    const { cache, base, wrapped } = setup();
    base.get.mockResolvedValue({ value: { kind: "APP_PAGE", html: "private" }, lastModified: 1 });

    await wrapped.get("/dashboard");
    await wrapped.get("/profile/alice", "fetch");
    expect(base.get).toHaveBeenCalledTimes(2);
    expect(cache.match).not.toHaveBeenCalled();
    expect(cache.put).not.toHaveBeenCalled();
  });

  it("removes a public copy when the underlying entry is deleted", async () => {
    const { cache, base, wrapped } = setup();
    base.get.mockResolvedValue({ value: { kind: "APP_PAGE", html: "public" }, lastModified: 1 });
    await wrapped.get("/");
    await finishBackground();

    await wrapped.delete("/");
    expect(base.delete).toHaveBeenCalledWith("/");
    expect(cache.delete).toHaveBeenCalledOnce();
  });
});
