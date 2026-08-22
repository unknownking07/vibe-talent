import Image from "next/image";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";

import { shortMint } from "@/lib/bags-board";
import { buildSparkline } from "@/lib/sparkline";
import { formatTokenPrice, formatTokenCount } from "@/lib/token-stats";
import type { TokenMarket } from "@/lib/token-market";

const CHART_WIDTH = 132;
const CHART_HEIGHT = 40;

export type TokenCardProps = {
  mint: string;
  /** Creator's fee share on this launch, in basis points, as Bags reports it. */
  royaltyBps: number | null;
  /** Null when GeckoTerminal has not indexed the token — normal before it trades. */
  market: TokenMarket | null;
  /** Daily closes, oldest first. Fewer than two points means no chart. */
  closes: number[];
};

/** Compact dollars: $2808.27 -> "$2.81K". */
function compactUsd(value: number): string {
  return `$${formatTokenCount(value)}`;
}

/** One launched coin: what it is, what it is worth, and where it is heading. */
export function TokenCard({
  mint,
  royaltyBps,
  market,
  closes,
}: TokenCardProps) {
  const spark = buildSparkline(closes, CHART_WIDTH, CHART_HEIGHT);
  const first = closes[0];
  const last = closes[closes.length - 1];
  const changePct =
    first !== undefined &&
    last !== undefined &&
    first !== 0 &&
    closes.length > 1
      ? ((last - first) / first) * 100
      : null;
  // A falling chart drawn in the "everything is fine" colour is a lie.
  const trendColor =
    changePct !== null && changePct < 0 ? "#ff4d4d" : "var(--bags-green)";

  return (
    <li
      className="rounded-[20px] p-5"
      style={{
        backgroundColor: "var(--bags-surface)",
        border: "1px solid var(--bags-border)",
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {market?.imageUrl ? (
            <Image
              src={market.imageUrl}
              alt=""
              width={44}
              height={44}
              className="h-11 w-11 shrink-0 rounded-full object-cover"
              style={{ border: "1px solid var(--bags-border)" }}
            />
          ) : (
            <div
              className="h-11 w-11 shrink-0 rounded-full"
              style={{ backgroundColor: "var(--bags-green-soft)" }}
            />
          )}
          <div className="min-w-0">
            <div className="truncate text-[16px] font-bold tracking-[-0.02em] text-[var(--bags-text)]">
              {market?.name ?? "Unindexed launch"}
            </div>
            <div className="mt-0.5 truncate font-mono text-[11px] text-[var(--bags-text-muted)]">
              {market?.symbol ? `$${market.symbol}` : null}
              {/* An already-shortened mint that then truncates reads as broken,
                  and phones have no room for both. The mint is one tap away on
                  the Bags link below. */}
              <span className="hidden sm:inline">
                {market?.symbol ? " · " : ""}
                {shortMint(mint)}
              </span>
            </div>
          </div>
        </div>

        {spark ? (
          <div className="shrink-0 text-right">
            <svg
              width={CHART_WIDTH}
              height={CHART_HEIGHT}
              viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
              role="img"
              aria-label={`Price over the last ${closes.length} days`}
              className="block"
            >
              <path d={spark.area} fill={trendColor} opacity={0.12} />
              <polyline
                points={spark.line}
                fill="none"
                stroke={trendColor}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {changePct !== null ? (
              <div
                className="mt-1 font-mono text-[11px] font-bold"
                style={{ color: trendColor }}
              >
                {changePct >= 0 ? "+" : ""}
                {changePct.toFixed(1)}%
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat
          label="price"
          value={
            market?.priceUsd != null ? formatTokenPrice(market.priceUsd) : "—"
          }
        />
        <Stat
          label="fdv"
          value={market?.fdvUsd != null ? compactUsd(market.fdvUsd) : "—"}
        />
        <Stat
          label="24h vol"
          value={
            market?.volume24hUsd != null ? compactUsd(market.volume24hUsd) : "—"
          }
        />
        <Stat
          label="fee share"
          // 0 bps is a real answer ("this creator takes no fee"), not a missing one.
          value={royaltyBps != null ? `${royaltyBps / 100}%` : "—"}
        />
      </dl>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        {market && !market.graduated && market.graduationPct !== null ? (
          <div className="min-w-[180px] flex-1">
            <div
              className="h-1.5 w-full overflow-hidden rounded-full"
              style={{ backgroundColor: "var(--bags-green-soft)" }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(Math.max(market.graduationPct, 0), 100)}%`,
                  backgroundColor: "var(--bags-green)",
                }}
              />
            </div>
            <p className="mt-2 text-[11px] text-[var(--bags-text-faint)]">
              {market.graduationPct.toFixed(1)}% of the way to graduating the
              bonding curve
            </p>
          </div>
        ) : market?.graduated ? (
          <p className="text-[11px] text-[var(--bags-text-faint)]">
            Graduated off the bonding curve
          </p>
        ) : (
          <p className="text-[11px] text-[var(--bags-text-faint)]">
            No market data yet — this launch has not traded.
          </p>
        )}

        <a
          href={`https://bags.fm/${mint}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`View ${market?.name ?? shortMint(mint)} on Bags (opens in new tab)`}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-bold transition-opacity hover:opacity-75"
          style={{
            backgroundColor: "var(--bags-green-soft)",
            color: "var(--bags-green)",
          }}
        >
          view on bags
          <ArrowUpRight size={11} weight="bold" />
        </a>
      </div>
    </li>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="bags-label text-[10px] font-semibold text-[var(--bags-text-faint)]">
        {label}
      </dt>
      <dd className="mt-1 font-mono text-[15px] font-bold text-[var(--bags-text)]">
        {value}
      </dd>
    </div>
  );
}
