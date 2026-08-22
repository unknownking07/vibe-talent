import { describe, it, expect, afterEach, vi } from "vitest";

import {
  bagsConfigured,
  fetchLaunchesForWallet,
  fetchCreatedLaunches,
  fetchCreatorProfile,
  fetchLaunchFeed,
} from "@/lib/bags";

const WALLET = "DYp2cUmgoBEYPxN9xPwiqKZoi5WR4SRAWJnLD1d5QAdT";
const MINT = "FfDYT3WqimMw7itMxw4kYJ26GPG78RfpZmepQCFpBAGS";

function mockFetch(
  body: unknown,
  init: { ok?: boolean; status?: number } = {},
) {
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
    mockFetch({
      success: true,
      response: { tokenMints: [MINT, "", null, 42, "short"] },
    });
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

// ---------------------------------------------------------------------------
// fetchCreatedLaunches
// ---------------------------------------------------------------------------
// Regression suite for the bug this function exists to prevent.
// fee-share/admin/list returns mints a wallet holds FEE AUTHORITY over, which
// is not the same as mints it launched. Against production, wallet 4Evn…WwX9
// returns three mints and has launched exactly one ($VIBE); the other two carry
// no creator record. Reporting three would credit a builder with work they did
// not do — the one failure a reputation product cannot ship.

describe("fetchCreatedLaunches", () => {
  const WALLET_A = "4EvnGaySWW6fhmQeTbjb7HXRbqzyCGWXPy8J8zziWwX9";
  const MINT_REAL = "FfDYT3WqimMw7itMxw4kYJ26GPG78RfpZmepQCFpBAGS";
  const MINT_EMPTY = "5BXaYHuS3FPxQMac9Zensi85XZ3tHo7YdzaxUqTBAGS";

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  /** Route each URL to a canned payload so one test can span both endpoints. */
  function routeFetch(routes: {
    admin: unknown;
    creators: Record<string, unknown>;
  }) {
    const fn = vi.fn().mockImplementation((input: URL | string) => {
      const url = String(input);
      const body = url.includes("/fee-share/admin/list")
        ? routes.admin
        : (routes.creators[
            new URL(url).searchParams.get("tokenMint") ?? ""
          ] ?? {
            success: true,
            response: [],
          });
      return Promise.resolve({ ok: true, status: 200, json: async () => body });
    });
    vi.stubGlobal("fetch", fn);
    return fn;
  }

  it("keeps only mints where this wallet is a confirmed creator", async () => {
    vi.stubEnv("BAGS_API_KEY", "k");
    routeFetch({
      admin: {
        success: true,
        response: { tokenMints: [MINT_EMPTY, MINT_REAL] },
      },
      creators: {
        [MINT_EMPTY]: { success: true, response: [] },
        [MINT_REAL]: {
          success: true,
          response: [
            {
              wallet: WALLET_A,
              isCreator: true,
              twitterUsername: "abhiontwt",
              royaltyBps: 8000,
            },
          ],
        },
      },
    });

    const out = await fetchCreatedLaunches(WALLET_A);
    expect(out).toEqual([
      { tokenMint: MINT_REAL, twitterUsername: "abhiontwt", royaltyBps: 8000 },
    ]);
  });

  it("excludes a token where the wallet is listed but is not the creator", async () => {
    vi.stubEnv("BAGS_API_KEY", "k");
    routeFetch({
      admin: { success: true, response: { tokenMints: [MINT_REAL] } },
      creators: {
        [MINT_REAL]: {
          success: true,
          // fee-share recipient on someone else's launch
          response: [{ wallet: WALLET_A, isCreator: false, royaltyBps: 1000 }],
        },
      },
    });
    expect(await fetchCreatedLaunches(WALLET_A)).toEqual([]);
  });

  it("excludes a token created by a different wallet", async () => {
    vi.stubEnv("BAGS_API_KEY", "k");
    routeFetch({
      admin: { success: true, response: { tokenMints: [MINT_REAL] } },
      creators: {
        [MINT_REAL]: {
          success: true,
          response: [
            {
              wallet: "SomeOtherWalletEntirely1111111111111111111",
              isCreator: true,
            },
          ],
        },
      },
    });
    expect(await fetchCreatedLaunches(WALLET_A)).toEqual([]);
  });

  it("omits a mint whose creator record could not be fetched, rather than assuming", async () => {
    vi.stubEnv("BAGS_API_KEY", "k");
    const fn = vi.fn().mockImplementation((input: URL | string) => {
      const url = String(input);
      if (url.includes("/fee-share/admin/list")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            response: { tokenMints: [MINT_REAL] },
          }),
        });
      }
      return Promise.reject(new Error("network"));
    });
    vi.stubGlobal("fetch", fn);
    expect(await fetchCreatedLaunches(WALLET_A)).toEqual([]);
  });

  it("propagates null when the candidate list itself is unavailable", async () => {
    vi.stubEnv("BAGS_API_KEY", "k");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    expect(await fetchCreatedLaunches(WALLET_A)).toBeNull();
  });

  it("returns [] without a second call when the wallet has no candidates", async () => {
    vi.stubEnv("BAGS_API_KEY", "k");
    const fn = routeFetch({
      admin: { success: true, response: { tokenMints: [] } },
      creators: {},
    });
    expect(await fetchCreatedLaunches(WALLET_A)).toEqual([]);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("defaults a missing twitter handle to null and missing royalty to 0", async () => {
    vi.stubEnv("BAGS_API_KEY", "k");
    routeFetch({
      admin: { success: true, response: { tokenMints: [MINT_REAL] } },
      creators: {
        [MINT_REAL]: {
          success: true,
          response: [{ wallet: WALLET_A, isCreator: true }],
        },
      },
    });
    expect(await fetchCreatedLaunches(WALLET_A)).toEqual([
      { tokenMint: MINT_REAL, twitterUsername: null, royaltyBps: 0 },
    ]);
  });
});

describe("fetchCreatorProfile", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns the Bags-side identity for the creating wallet", async () => {
    vi.stubEnv("BAGS_API_KEY", "test-key");
    mockFetch({
      success: true,
      response: [
        {
          wallet: WALLET,
          isCreator: true,
          bagsUsername: "defiunknownking",
          twitterUsername: "abhiontwt",
          pfp: "https://pbs.twimg.com/profile_images/abc.jpg",
          royaltyBps: 8000,
        },
      ],
    });

    expect(await fetchCreatorProfile(MINT, WALLET)).toEqual({
      bagsUsername: "defiunknownking",
      twitterUsername: "abhiontwt",
      pfpUrl: "https://pbs.twimg.com/profile_images/abc.jpg",
      royaltyBps: 8000,
    });
  });

  it("ignores fee-share recipients who did not create the token", async () => {
    // Bags lists every fee recipient on a launch. Reading identity off the wrong
    // one would print a stranger's handle under a builder's launch.
    vi.stubEnv("BAGS_API_KEY", "test-key");
    mockFetch({
      success: true,
      response: [
        {
          wallet: "OtherWallet1111111111111111111111111111111",
          isCreator: true,
          bagsUsername: "someoneelse",
        },
        { wallet: WALLET, isCreator: false, bagsUsername: "notthecreator" },
      ],
    });

    expect(await fetchCreatorProfile(MINT, WALLET)).toBeNull();
  });

  it("blanks out empty strings rather than rendering them", async () => {
    vi.stubEnv("BAGS_API_KEY", "test-key");
    mockFetch({
      success: true,
      response: [
        {
          wallet: WALLET,
          isCreator: true,
          bagsUsername: "   ",
          twitterUsername: "",
        },
      ],
    });

    expect(await fetchCreatorProfile(MINT, WALLET)).toEqual({
      bagsUsername: null,
      twitterUsername: null,
      pfpUrl: null,
      royaltyBps: 0,
    });
  });

  it("returns null when Bags cannot answer", async () => {
    vi.stubEnv("BAGS_API_KEY", "test-key");
    mockFetch({ success: false }, { ok: false, status: 500 });
    expect(await fetchCreatorProfile(MINT, WALLET)).toBeNull();
  });
});

describe("fetchLaunchFeed", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("reads the launches Bags publishes, including pre-graduation ones", () => {
    vi.stubEnv("BAGS_API_KEY", "test-key");
    mockFetch({
      success: true,
      response: [
        {
          tokenMint: MINT,
          name: "VIBE TALENT",
          symbol: "VIBE",
          status: "PRE_GRAD",
        },
      ],
    });

    return expect(fetchLaunchFeed()).resolves.toEqual([
      {
        tokenMint: MINT,
        name: "VIBE TALENT",
        symbol: "VIBE",
        status: "PRE_GRAD",
      },
    ]);
  });

  it("drops the creator-supplied image and twitter fields", async () => {
    // The image host set is unbounded and attacker-chosen, and the twitter
    // handle is typed at launch. Neither may reach a page from here.
    vi.stubEnv("BAGS_API_KEY", "test-key");
    mockFetch({
      success: true,
      response: [
        {
          tokenMint: MINT,
          name: "Coin",
          symbol: "C",
          status: "PRE_GRAD",
          image: "https://whatever.example/evil.png",
          twitter: "someoneelse",
        },
      ],
    });

    const [launch] = (await fetchLaunchFeed())!;
    expect(launch).not.toHaveProperty("image");
    expect(launch).not.toHaveProperty("twitter");
  });

  it("skips entries whose mint is not a plausible address", async () => {
    vi.stubEnv("BAGS_API_KEY", "test-key");
    mockFetch({
      success: true,
      response: [
        { tokenMint: "nope!" },
        { name: "no mint at all" },
        { tokenMint: MINT },
      ],
    });

    const feed = await fetchLaunchFeed();
    expect(feed).toHaveLength(1);
    expect(feed![0]!.tokenMint).toBe(MINT);
  });

  it("returns null when Bags cannot answer, so a bad run is not an empty one", async () => {
    vi.stubEnv("BAGS_API_KEY", "test-key");
    mockFetch({ success: false }, { ok: false, status: 500 });
    expect(await fetchLaunchFeed()).toBeNull();
  });
});
