// Single source of truth for the on-chain Featured Promotion prices.
// Used by /pricing (FE + metadata + JSON-LD), /llms.txt, and the FE fallback.
// Server-fetched and cached so the SEO/AEO surfaces stay in sync with the
// FE display, and a single contract update propagates to every consumer.

import { CHAIN_CONFIGS, isEVMChain } from "./chains-config";

const GET_PRICES_SELECTOR = "0xbd9a548b";

export type PriceSnapshot = {
  // USDC, 2-decimal (matches user-facing display, not on-chain 6-decimal base).
  day: number;
  threeDay: number; // hidden in UI but kept for array shape
  week: number;
  month: number;
  annual: number;
  source: "chain" | "fallback";
};

const FALLBACK_SNAPSHOT: PriceSnapshot = {
  day: 2,
  threeDay: 5,
  week: 10,
  month: 29,
  annual: 199,
  source: "fallback",
};

export async function getPriceSnapshot(): Promise<PriceSnapshot> {
  const config = CHAIN_CONFIGS.base;
  if (!isEVMChain(config)) return FALLBACK_SNAPSHOT;
  try {
    const res = await fetch(config.rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_call",
        params: [{ to: config.contractAddr, data: GET_PRICES_SELECTOR }, "latest"],
      }),
      // Cache server-side for 5 min — prices change rarely (admin-controlled).
      next: { revalidate: 300 },
    });
    const json = await res.json();
    if (!json.result || typeof json.result !== "string") return FALLBACK_SNAPSHOT;
    const data = json.result.startsWith("0x") ? json.result.slice(2) : json.result;
    if (data.length < 5 * 64) return FALLBACK_SNAPSHOT;
    const tiers: number[] = [];
    for (let i = 0; i < 5; i++) {
      tiers.push(Number(BigInt("0x" + data.slice(i * 64, i * 64 + 64))) / 1e6);
    }
    return {
      day: tiers[0],
      threeDay: tiers[1],
      week: tiers[2],
      month: tiers[3],
      annual: tiers[4],
      source: "chain",
    };
  } catch {
    return FALLBACK_SNAPSHOT;
  }
}

export function formatUsd(value: number): string {
  // Sub-dollar prices need cents; whole-dollar tiers don't.
  return value >= 1 && Number.isInteger(value) ? `$${value}` : `$${value.toFixed(2)}`;
}
