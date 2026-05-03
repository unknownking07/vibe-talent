import { Check } from "lucide-react";
import { CHAIN_CONFIGS, isEVMChain } from "@/lib/chains-config";
import { ChainDot } from "@/components/ui/featured/chain-dot";
import { formatUsd, type PriceSnapshot } from "@/lib/pricing";

const BASE_CONFIG = CHAIN_CONFIGS.base;
const CONTRACT_ADDR = isEVMChain(BASE_CONFIG) ? BASE_CONFIG.contractAddr : "";

const TIERS: { key: keyof Omit<PriceSnapshot, "source">; label: string; duration: string; note: string }[] = [
  { key: "day",    label: "Day",    duration: "24 hours", note: "Quick boost — perfect for launch days" },
  { key: "week",   label: "Week",   duration: "7 days",   note: "Sustained exposure across a hiring cycle" },
  { key: "month",  label: "Month",  duration: "30 days",  note: "Full hiring cycle, the sweet spot" },
  { key: "annual", label: "Annual", duration: "Year-round (slot persists indefinitely)", note: "Permanent visibility — refunded only if the contract is upgraded" },
];

export function PricingTiers({ initialPrices }: { initialPrices: PriceSnapshot }) {
  const isLive = initialPrices.source === "chain";

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
          {isLive ? "Live on-chain pricing" : "Estimated pricing (RPC unreachable)"}
        </span>
      </div>

      {/* Tier grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {TIERS.map((t) => {
          const price = initialPrices[t.key];
          const isHighlight = t.key === "month";
          return (
            <div
              key={t.key}
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
                  {formatUsd(price)}
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
