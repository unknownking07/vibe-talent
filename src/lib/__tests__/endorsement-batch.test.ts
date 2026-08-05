import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchEndorsementState } from "../endorsement-batch";

/** Reads the `project_ids` a stubbed fetch call was made with. */
function idsFrom(call: string) {
  const query = new URL(call, "http://localhost").searchParams.get("project_ids");
  return (query ?? "").split(",").filter(Boolean);
}

function jsonResponse(results: Record<string, { count: number; user_endorsed: boolean }>) {
  return { ok: true, status: 200, json: async () => ({ results }) } as unknown as Response;
}

describe("fetchEndorsementState", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("coalesces concurrent lookups into a single request", async () => {
    const states = {
      a: { count: 3, user_endorsed: true },
      b: { count: 0, user_endorsed: false },
      c: { count: 7, user_endorsed: false },
    };
    // Answer only what was asked for, the way the route handler does.
    const fetchMock = vi.fn(async (url: string) =>
      jsonResponse(
        Object.fromEntries(idsFrom(url).map((id) => [id, states[id as keyof typeof states]])),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    // Three cards mounting in the same tick, exactly as a project grid does.
    const pending = Promise.all([
      fetchEndorsementState("a"),
      fetchEndorsementState("b"),
      fetchEndorsementState("c"),
    ]);

    await vi.runAllTimersAsync();
    const results = await pending;

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(idsFrom(fetchMock.mock.calls[0][0] as unknown as string)).toEqual(["a", "b", "c"]);
    expect(results).toEqual([
      { count: 3, user_endorsed: true },
      { count: 0, user_endorsed: false },
      { count: 7, user_endorsed: false },
    ]);
  });

  it("dedupes a project requested by more than one card but settles both", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      jsonResponse(
        Object.fromEntries(idsFrom(url).map((id) => [id, { count: 2, user_endorsed: false }])),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const pending = Promise.all([fetchEndorsementState("dup"), fetchEndorsementState("dup")]);
    await vi.runAllTimersAsync();
    const results = await pending;

    expect(idsFrom(fetchMock.mock.calls[0][0] as unknown as string)).toEqual(["dup"]);
    expect(results).toEqual([
      { count: 2, user_endorsed: false },
      { count: 2, user_endorsed: false },
    ]);
  });

  it("splits batches larger than the route handler's 50-id cap", async () => {
    const ids = Array.from({ length: 60 }, (_, i) => `p${i}`);
    const fetchMock = vi.fn(async (url: string) =>
      jsonResponse(
        Object.fromEntries(idsFrom(url).map((id) => [id, { count: 1, user_endorsed: false }])),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const pending = Promise.all(ids.map((id) => fetchEndorsementState(id)));
    await vi.runAllTimersAsync();
    const results = await pending;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(idsFrom(fetchMock.mock.calls[0][0] as unknown as string)).toHaveLength(50);
    expect(idsFrom(fetchMock.mock.calls[1][0] as unknown as string)).toHaveLength(10);
    expect(results).toHaveLength(60);
  });

  it("rejects every waiter when the request fails, rather than hanging", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500 }) as Response));

    const settled = Promise.allSettled([fetchEndorsementState("x"), fetchEndorsementState("y")]);
    await vi.runAllTimersAsync();

    expect((await settled).map((r) => r.status)).toEqual(["rejected", "rejected"]);
  });

  it("rejects only the waiter a successful response left out", async () => {
    // The route answers 200 but omits one id — a project deleted between render
    // and lookup, say. The present one must still resolve.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ present: { count: 4, user_endorsed: false } })),
    );

    const settled = Promise.allSettled([
      fetchEndorsementState("present"),
      fetchEndorsementState("absent"),
    ]);
    await vi.runAllTimersAsync();
    const [present, absent] = await settled;

    expect(present).toEqual({
      status: "fulfilled",
      value: { count: 4, user_endorsed: false },
    });
    expect(absent.status).toBe("rejected");
  });

  it("starts a fresh batch after the previous one has flushed", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      jsonResponse(
        Object.fromEntries(idsFrom(url).map((id) => [id, { count: 0, user_endorsed: false }])),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const first = fetchEndorsementState("first");
    await vi.runAllTimersAsync();
    await first;

    const second = fetchEndorsementState("second");
    await vi.runAllTimersAsync();
    await second;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(idsFrom(fetchMock.mock.calls[1][0] as unknown as string)).toEqual(["second"]);
  });
});
