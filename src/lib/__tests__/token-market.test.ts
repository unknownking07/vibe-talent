import { describe, it, expect, afterEach, vi } from "vitest";

import {
  fetchTokenMarket,
  fetchDailyCloses,
  changePct,
} from "@/lib/token-market";

const MINT = "FfDYT3WqimMw7itMxw4kYJ26GPG78RfpZmepQCFpBAGS";
const POOL = "2tFgxKjVjppSLp2bQR9YJpLZW5zc5qaFdsEtzwcyjuF2";

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

const TOKEN_BODY = {
  data: {
    attributes: {
      name: "VIBE TALENT",
      symbol: "VIBE",
      image_url: "https://assets.geckoterminal.com/abc",
      price_usd: "0.000002808278971",
      fdv_usd: "2808.2789708513",
      volume_usd: { h24: "12.5" },
      launchpad_details: { graduation_percentage: 2.04, completed: false },
    },
    relationships: {
      top_pools: { data: [{ id: `solana_${POOL}`, type: "pool" }] },
    },
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("fetchTokenMarket", () => {
  it("maps GeckoTerminal's string numerics onto real numbers", async () => {
    mockFetch(TOKEN_BODY);
    const market = await fetchTokenMarket(MINT);

    expect(market).toMatchObject({
      mint: MINT,
      name: "VIBE TALENT",
      symbol: "VIBE",
      priceUsd: 0.000002808278971,
      fdvUsd: 2808.2789708513,
      volume24hUsd: 12.5,
      graduationPct: 2.04,
      graduated: false,
    });
  });

  it("strips the network prefix off the pool id", async () => {
    mockFetch(TOKEN_BODY);
    const market = await fetchTokenMarket(MINT);
    expect(market?.poolAddress).toBe(POOL);
  });

  it("returns null when the token is not indexed", async () => {
    mockFetch({ errors: [{ status: "404" }] }, { ok: false, status: 404 });
    expect(await fetchTokenMarket(MINT)).toBeNull();
  });

  it("returns null rather than throwing when the request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down")),
    );
    expect(await fetchTokenMarket(MINT)).toBeNull();
  });

  it("survives a payload with no launchpad or pool data", async () => {
    mockFetch({ data: { attributes: { name: "Bare", symbol: "BARE" } } });
    const market = await fetchTokenMarket(MINT);
    expect(market).toMatchObject({
      name: "Bare",
      priceUsd: null,
      graduationPct: null,
      graduated: false,
      poolAddress: null,
    });
  });
});

describe("fetchDailyCloses", () => {
  it("returns closes oldest first", async () => {
    // GeckoTerminal sends newest first.
    mockFetch({
      data: {
        attributes: {
          ohlcv_list: [
            [1787270400, 2, 3, 1, 3, 9],
            [1787184000, 1, 2, 1, 2, 4],
            [1787097600, 1, 1, 1, 1, 1],
          ],
        },
      },
    });

    expect(await fetchDailyCloses(POOL)).toEqual([1, 2, 3]);
  });

  it("skips malformed candles instead of dropping the series", async () => {
    mockFetch({
      data: {
        attributes: {
          ohlcv_list: [[1, 1, 1, 1, 5, 1], "junk", [2, 1, 1, 1, null, 1]],
        },
      },
    });
    expect(await fetchDailyCloses(POOL)).toEqual([5]);
  });

  it("returns an empty series when the pool has no candles", async () => {
    mockFetch({ data: { attributes: {} } });
    expect(await fetchDailyCloses(POOL)).toEqual([]);
  });
});

describe("changePct", () => {
  it("measures first close against last", () => {
    expect(changePct([2, 4])).toBe(100);
    expect(changePct([4, 2])).toBe(-50);
  });

  it("has nothing to report on a single point", () => {
    expect(changePct([1])).toBeNull();
  });

  it("refuses to divide by a zero open", () => {
    expect(changePct([0, 5])).toBeNull();
  });
});
