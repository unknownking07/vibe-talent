import { describe, it, expect, afterEach, vi } from "vitest";

import {
  formatUsdCompact,
  fetchTokenMarket,
  fetchDailyCloses,
  changePct,
  fetchBagsDexPools,
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

describe("fetchBagsDexPools", () => {
  const POOL_BODY = {
    data: [
      {
        attributes: {
          name: "KIRK / SOL",
          fdv_usd: "27519.51014",
          volume_usd: { h24: "3858.62" },
          pool_created_at: "2026-08-21T14:48:26Z",
        },
        relationships: {
          base_token: { data: { id: "solana_MintKirk", type: "token" } },
        },
      },
    ],
    included: [
      {
        type: "token",
        attributes: {
          address: "MintKirk",
          name: "OFFICIAL CHARLIE KIRK COIN",
          symbol: "KIRK",
          image_url: null,
        },
      },
    ],
  };

  it("requests the Bags dex, busiest first, with the token included", async () => {
    // The dex slug, the sort key and the include are what decide which launches
    // the discovery cron ever sees. Without this, changing any of them keeps
    // every other test green.
    const fetchMock = mockFetch(POOL_BODY);
    await fetchBagsDexPools(3);

    const url = String(fetchMock.mock.calls[0]![0]);
    expect(url).toContain("/networks/solana/dexes/bags-fm/pools");
    expect(url).toContain("page=3");
    expect(url).toContain("sort=h24_volume_usd_desc");
    expect(url).toContain("include=base_token");
  });

  it("joins each pool to its included base token", async () => {
    mockFetch(POOL_BODY);
    const [listing] = await fetchBagsDexPools();

    expect(listing).toEqual({
      mint: "MintKirk",
      name: "OFFICIAL CHARLIE KIRK COIN",
      symbol: "KIRK",
      imageUrl: null,
      fdvUsd: 27519.51014,
      volume24hUsd: 3858.62,
      poolCreatedAt: "2026-08-21T14:48:26Z",
    });
  });

  it("still lists a pool whose token was not included", async () => {
    // The mint is the identifier that matters; a missing name is cosmetic.
    mockFetch({ ...POOL_BODY, included: [] });
    const [listing] = await fetchBagsDexPools();
    expect(listing).toMatchObject({
      mint: "MintKirk",
      name: null,
      symbol: null,
    });
  });

  it("passes hostile names through untouched, for the caller to sanitise", async () => {
    // Sanitising here would hide the raw value from anything that needs it;
    // the contract is that display code cleans it.
    const hostile = "\u202EAYNA";
    mockFetch({
      ...POOL_BODY,
      included: [
        { type: "token", attributes: { address: "MintKirk", name: hostile } },
      ],
    });
    const [listing] = await fetchBagsDexPools();
    expect(listing!.name).toBe(hostile);
  });

  it("skips entries with no usable base token reference", async () => {
    mockFetch({ data: [{ attributes: {} }, "junk"], included: [] });
    expect(await fetchBagsDexPools()).toEqual([]);
  });

  it("returns an empty list when GeckoTerminal cannot answer", async () => {
    mockFetch({}, { ok: false, status: 500 });
    expect(await fetchBagsDexPools()).toEqual([]);
  });
});

describe("formatUsdCompact", () => {
  it("keeps cents rather than rounding money to whole dollars", () => {
    // formatTokenCount renders these as "$13" and "$0", which is wrong for a
    // dollar amount and common at the volumes on this board.
    expect(formatUsdCompact(12.5)).toBe("$12.50");
    expect(formatUsdCompact(0.4)).toBe("$0.40");
  });

  it("abbreviates larger amounts without losing precision to rounding", () => {
    expect(formatUsdCompact(1234.5)).toBe("$1.23K");
    expect(formatUsdCompact(27519.51)).toBe("$27.52K");
    expect(formatUsdCompact(2_500_000)).toBe("$2.50M");
    expect(formatUsdCompact(3_100_000_000)).toBe("$3.10B");
  });

  it("renders a real zero as a zero", () => {
    expect(formatUsdCompact(0)).toBe("$0");
  });
});
