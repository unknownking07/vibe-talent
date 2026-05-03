type ChainKey = "base" | "solana";

const COLORS: Record<ChainKey, string> = {
  base: "#0052FF",
  solana: "conic-gradient(from 90deg, #9945FF, #14F195, #00C2FF, #9945FF)",
};

const LABELS: Record<ChainKey, string> = {
  base: "Base",
  solana: "Solana",
};

export function ChainDot({
  chain,
  withLabel = false,
  size = 12,
}: {
  chain: ChainKey;
  withLabel?: boolean;
  size?: number;
}) {
  const isGradient = chain === "solana";
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="inline-block rounded-full shrink-0"
        style={{
          width: size,
          height: size,
          background: isGradient ? COLORS[chain] : undefined,
          backgroundColor: isGradient ? undefined : COLORS[chain],
        }}
        aria-hidden="true"
      />
      {withLabel && (
        <span className="text-xs font-bold text-[var(--foreground)]">{LABELS[chain]}</span>
      )}
    </span>
  );
}

export type { ChainKey };
