import { describe, it, expect, afterEach, vi } from "vitest";

import { bagsConfigured, fetchLaunchesForWallet } from "@/lib/bags";

const WALLET = "DYp2cUmgoBEYPxN9xPwiqKZoi5WR4SRAWJnLD1d5QAdT";
const MINT = "FfDYT3WqimMw7itMxw4kYJ26GPG78RfpZmepQCFpBAGS";

function mockFetch(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  const fn = vi.fn().mockResolvedValue({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("bagsConfigured", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("is false when BAGS_API_KEY is unset", () => {
    vi.stubEnv("BAGS_API_KEY", undefined);
    expect(bagsConfigured()).toBe(false);
  });

  it("treats a blank key as unset", () => {
    vi.stubEnv("BAGS_API_KEY", "   ");
    expect(bagsConfigured()).toBe(false);
  });

  it("is true once a key is present", () => {
    vi.stubEnv("BAGS_API_KEY", "test-key");
    expect(bagsConfigured()).toBe(true);
  });
});

describe("fetchLaunchesForWallet", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns null without a key, and never calls out", async () => {
    vi.stubEnv("BAGS_API_KEY", undefined);
    const f = mockFetch({});
    expect(await fetchLaunchesForWallet(WALLET)).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });

  it("returns the mints on success", async () => {
    vi.stubEnv("BAGS_API_KEY", "k");
    mockFetch({ success: true, response: { tokenMints: [MINT] } });
    expect(await fetchLaunchesForWallet(WALLET)).toEqual([MINT]);
  });

  it("sends the key as x-api-key", async () => {
    vi.stubEnv("BAGS_API_KEY", "secret-key");
    const f = mockFetch({ success: true, response: { tokenMints: [] } });
    await fetchLaunchesForWallet(WALLET);
    const headers = f.mock.calls[0][1].headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("secret-key");
  });

  it("puts the wallet in the query string", async () => {
    vi.stubEnv("BAGS_API_KEY", "k");
    const f = mockFetch({ success: true, response: { tokenMints: [] } });
    await fetchLaunchesForWallet(WALLET);
    expect(String(f.mock.calls[0][0])).toContain(`wallet=${WALLET}`);
  });

  // [] and null mean different things to callers: one is "asked, none", the
  // other "could not ask". Collapsing them would cache an outage as fact.
  it("distinguishes an empty result from a failure", async () => {
    vi.stubEnv("BAGS_API_KEY", "k");
    mockFetch({ success: true, response: { tokenMints: [] } });
    expect(await fetchLaunchesForWallet(WALLET)).toEqual([]);

    mockFetch({ success: false, error: "nope" });
    expect(await fetchLaunchesForWallet(WALLET)).toBeNull();
  });

  it("returns null on a non-ok response", async () => {
    vi.stubEnv("BAGS_API_KEY", "k");
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockFetch({}, { ok: false, status: 401 });
    expect(await fetchLaunchesForWallet(WALLET)).toBeNull();
  });

  it("logs when the key is rejected, so a dead key isn't mistaken for no launches", async () => {
    vi.stubEnv("BAGS_API_KEY", "k");
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    mockFetch({}, { ok: false, status: 401 });
    await fetchLaunchesForWallet(WALLET);
    expect(err).toHaveBeenCalledOnce();
  });

  it("returns null when fetch throws", async () => {
    vi.stubEnv("BAGS_API_KEY", "k");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
    expect(await fetchLaunchesForWallet(WALLET)).toBeNull();
  });

  it("rejects a malformed wallet without calling out", async () => {
    vi.stubEnv("BAGS_API_KEY", "k");
    const f = mockFetch({});
    expect(await fetchLaunchesForWallet("not-a-wallet")).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });

  it("drops entries that are not plausible mints", async () => {
    vi.stubEnv("BAGS_API_KEY", "k");
    mockFetch({ success: true, response: { tokenMints: [MINT, "", null, 42, "short"] } });
    expect(await fetchLaunchesForWallet(WALLET)).toEqual([MINT]);
  });

  it("returns null when tokenMints is missing or the wrong shape", async () => {
    vi.stubEnv("BAGS_API_KEY", "k");
    mockFetch({ success: true, response: {} });
    expect(await fetchLaunchesForWallet(WALLET)).toBeNull();

    mockFetch({ success: true, response: { tokenMints: "nope" } });
    expect(await fetchLaunchesForWallet(WALLET)).toBeNull();
  });
});
