"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { CHAIN_CONFIGS, isEVMChain } from "@/lib/chains-config";
import { ChainDot } from "@/components/ui/featured/chain-dot";

const BASE_CONFIG = CHAIN_CONFIGS.base;
const CONTRACT_ADDR = isEVMChain(BASE_CONFIG) ? BASE_CONFIG.contractAddr : "";
const BASE_RPC = isEVMChain(BASE_CONFIG) ? BASE_CONFIG.rpc : "";

// keccak256("getPrices()") first 4 bytes — same selector used by the homepage card
const GET_PRICES_SELECTOR = "0xbd9a548b";

// Fallback prices — the actual prices come from the on-chain contract via
// fetchPrices(). The contract has 5 package slots (0..4); we surface 4 to
// users (Day/Week/Month/Annual) and skip the 3-day legacy slot.
const FALLBACK_PRICES: bigint[] = [
  BigInt(2_000_000),    // 0: Day    — $2.00
  BigInt(5_000_000),    // 1: 3-day (hidden, must fit monotonic curve)
  BigInt(10_000_000),   // 2: Week   — $10.00 (29% off /day)
  BigInt(29_000_000),   // 3: Month  — $29.00 (52% off /day — best value)
  BigInt(199_000_000),  // 4: Annual — $199.00 (73% off /day; contract treats as Lifetime)
];

const TIERS = [
  { idx: 0, label: "Day", duration: "24 hours", note: "Quick boost — perfect for launch days" },
  { idx: 2, label: "Week", duration: "7 days", note: "Sustained exposure across a hiring cycle" },
  { idx: 3, label: "Month", duration: "30 days", note: "Full hiring cycle, the sweet spot" },
  { idx: 4, label: "Annual", duration: "Year-round (slot persists indefinitely)", note: "Permanent visibility — refunded only if the contract is upgraded" },
] as const;

async function fetchPrices(): Promise<bigint[]> {
  try {
    const res = await fetch(BASE_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_call",
        params: [{ to: CONTRACT_ADDR, data: GET_PRICES_SELECTOR }, "latest"],
      }),
    });
    const json = await res.json();
    if (!json.result || typeof json.result !== "string") return FALLBACK_PRICES;
    const data = json.result.startsWith("0x") ? json.result.slice(2) : json.result;
    // Need 5 × 32-byte slots (320 hex chars). Shorter = truncated/error payload.
    if (data.length < 5 * 64) return FALLBACK_PRICES;
    const prices: bigint[] = [];
    for (let i = 0; i < 5; i++) {
      prices.push(BigInt("0x" + data.slice(i * 64, i * 64 + 64)));
    }
    return prices;
  } catch {
    return FALLBACK_PRICES;
  }
}

function format(price: bigint): string {
  return `$${(Number(price) / 1e6).toFixed(2)}`;
}

export function PricingTiers() {
  const [prices, setPrices] = useState<bigint[]>(FALLBACK_PRICES);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchPrices().then((p) => {
      if (cancelled) return;
      setPrices(p);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      {/* Chain rail */}
      <div
        className="flex flex-wrap items-center gap-4 px-5 py-4 mb-6"
        style={{ backgroundColor: "var(--bg-surface-light)", border: "2px solid var(--border-hard)" }}
      >
        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
          Pay with USDC on
        </span>
        <span
          className="flex items-center gap-2 px-3 py-1.5"
          style={{ border: "2px solid var(--border-hard)", backgroundColor: "var(--bg-surface)" }}
        >
          <ChainDot chain="base" />
          <span className="text-xs font-extrabold uppercase">Base</span>
        </span>
        <span
          className="flex items-center gap-2 px-3 py-1.5"
          style={{ border: "2px solid var(--border-hard)", backgroundColor: "var(--bg-surface)" }}
        >
          <ChainDot chain="solana" />
          <span className="text-xs font-extrabold uppercase">Solana</span>
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] ml-auto">
          {loaded ? "Live on-chain pricing" : "Loading…"}
        </span>
      </div>

      {/* Tier grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {TIERS.map((t) => {
          const price = prices[t.idx];
          const isHighlight = t.idx === 3; // Month — best value
          return (
            <div
              key={t.idx}
              className="card-brutal p-5 flex flex-col"
              style={{
                backgroundColor: "var(--bg-surface)",
                borderLeft: isHighlight ? "4px solid var(--accent)" : undefined,
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  {t.duration}
                </span>
                {isHighlight && (
                  <span
                    className="font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5"
                    style={{ backgroundColor: "var(--accent)", color: "white" }}
                  >
                    Best
                  </span>
                )}
              </div>
              <h3 className="text-2xl font-extrabold uppercase text-[var(--foreground)] mb-2 leading-tight">
                {t.label}
              </h3>
              <div className="flex items-baseline gap-1.5 mb-3">
                <span className="font-mono text-3xl font-extrabold text-[var(--foreground)]">
                  {format(price)}
                </span>
                <span className="text-xs font-bold uppercase text-[var(--text-muted)]">USDC</span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-4">{t.note}</p>
              <ul className="text-xs text-[var(--text-secondary)] font-medium space-y-1.5 mt-auto">
                <li className="flex items-start gap-1.5">
                  <Check size={12} className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }} />
                  Homepage Featured Projects slot
                </li>
                <li className="flex items-start gap-1.5">
                  <Check size={12} className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }} />
                  Live indicator + project image
                </li>
                <li className="flex items-start gap-1.5">
                  <Check size={12} className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }} />
                  Direct link to your live URL or profile
                </li>
              </ul>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-[10px] text-[var(--text-muted)] font-mono">
        Prices read from contract {CONTRACT_ADDR.slice(0, 10)}…{CONTRACT_ADDR.slice(-6)} on Base. Solana payments
        transfer USDC to the receiving wallet at the same rate. All amounts shown in USDC; gas paid separately in
        ETH (Base) or SOL (Solana).
      </p>
    </div>
  );
}
