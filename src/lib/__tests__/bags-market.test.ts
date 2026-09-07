import { describe, it, expect } from "vitest";

import { buildMarketUpdates, type ExistingLaunch } from "@/lib/bags-market";
import type { TokenMarket } from "@/lib/token-market";

const NOW = "2026-09-07T12:00:00.000Z";

function market(mint: string, over: Partial<TokenMarket> = {}): TokenMarket {
  return {
    mint,
    name: "Token",
    symbol: "TKN",
    imageUrl: "https://assets.geckoterminal.com/img",
    priceUsd: 0.001,
    fdvUsd: 1000,
    volume24hUsd: 25,
    graduationPct: null,
    graduated: false,
    poolAddress: null,
    ...over,
  };
}

const EXISTING: ExistingLaunch[] = [
  { token_mint: "AAA", creator_wallet: "wallet-a" },
  { token_mint: "BBB", creator_wallet: "wallet-b" },
];

describe("buildMarketUpdates", () => {
  it("writes the market data for a mint that was asked about and indexed", () => {
    const updates = buildMarketUpdates(
      new Set(["AAA"]),
      new Map([["AAA", market("AAA")]]),
      EXISTING,
      NOW,
    );

    expect(updates).toEqual([
      {
        token_mint: "AAA",
        creator_wallet: "wallet-a",
        token_image_url: "https://assets.geckoterminal.com/img",
        fdv_usd: 1000,
        volume_24h_usd: 25,
        market_synced_at: NOW,
      },
    ]);
  });

  it("stores nulls for a mint that was asked about but is unindexed", () => {
    const updates = buildMarketUpdates(
      new Set(["AAA"]),
      new Map(),
      EXISTING,
      NOW,
    );

    // Asked, and there is genuinely nothing — a finding worth recording.
    expect(updates).toHaveLength(1);
    expect(updates[0].fdv_usd).toBeNull();
    expect(updates[0].token_image_url).toBeNull();
  });

  it("leaves a mint that was never answered for entirely alone", () => {
    const updates = buildMarketUpdates(
      new Set(["AAA"]),
      new Map([["AAA", market("AAA")]]),
      EXISTING,
      NOW,
    );

    // BBB was not answered for, so it keeps whatever price it already had.
    expect(updates.map((u) => u.token_mint)).toEqual(["AAA"]);
  });

  it("cannot invent a launch that is not already in the table", () => {
    const updates = buildMarketUpdates(
      new Set(["AAA", "EVIL"]),
      new Map([
        ["AAA", market("AAA")],
        ["EVIL", market("EVIL")],
      ]),
      EXISTING,
      NOW,
    );

    expect(updates.map((u) => u.token_mint)).toEqual(["AAA"]);
  });

  it("takes the creator wallet from our table, never from the answer", () => {
    const impersonating = market("AAA");
    // Whatever a payload carries, identity is read back out of our own row.
    const updates = buildMarketUpdates(
      new Set(["AAA"]),
      new Map([["AAA", { ...impersonating, mint: "AAA" }]]),
      [{ token_mint: "AAA", creator_wallet: "wallet-a" }],
      NOW,
    );

    expect(updates[0].creator_wallet).toBe("wallet-a");
  });

  it("writes only the four market columns plus the row's own identity", () => {
    const updates = buildMarketUpdates(
      new Set(["AAA"]),
      new Map([["AAA", market("AAA")]]),
      EXISTING,
      NOW,
    );

    // user_id, bags_username, token_symbol and last_verified_at must never
    // appear here: the conflict update only touches keys in the payload.
    expect(Object.keys(updates[0]).sort()).toEqual([
      "creator_wallet",
      "fdv_usd",
      "market_synced_at",
      "token_image_url",
      "token_mint",
      "volume_24h_usd",
    ]);
  });
});
