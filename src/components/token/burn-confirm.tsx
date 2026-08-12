"use client";

import { useState } from "react";
import { Fire, Warning, CircleNotch } from "@phosphor-icons/react";
import { formatTokenCount } from "@/lib/token-stats";

/**
 * The confirmation shown before any $VIBE burn.
 *
 * Burning is irreversible and involves real money, so the consequence has to be
 * unmissable BEFORE the wallet opens. Users arriving from a hiring marketplace
 * should not be assumed to know what "burn" means on-chain — the most likely
 * misconception is that the tokens go to the builder, or to VibeTalent, so the
 * copy says plainly that nobody receives them.
 */
type Props = {
  /** Whole tokens about to be destroyed. */
  tokenAmount: number;
  usdAmount: number;
  /** What the burn achieves, e.g. "@karan gets +2 vibe score". */
  outcome: string;
  /** Who the user might wrongly assume receives the tokens. */
  recipientDisclaimer: string;
  busy: boolean;
  onConfirm: () => void;
  onBack: () => void;
};

export function BurnConfirm({
  tokenAmount,
  usdAmount,
  outcome,
  recipientDisclaimer,
  busy,
  onConfirm,
  onBack,
}: Props) {
  const [acknowledged, setAcknowledged] = useState(false);

  return (
    <div
      className="p-4"
      style={{
        border: "1px solid var(--accent)",
        borderRadius: "var(--radius-card)",
        backgroundColor: "color-mix(in srgb, var(--accent) 6%, var(--bg-surface))",
      }}
    >
      <div className="flex items-center gap-2">
        <Warning weight="fill" size={18} style={{ color: "var(--accent)" }} aria-hidden="true" />
        <h3 className="text-sm font-extrabold uppercase tracking-wide text-[var(--foreground)]">
          This burn is permanent
        </h3>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-[var(--foreground)]">
        You&apos;re about to destroy{" "}
        <strong className="font-mono">
          {tokenAmount.toLocaleString("en-US", { maximumFractionDigits: 0 })} $VIBE
        </strong>{" "}
        (~${usdAmount.toFixed(2)}) forever.
      </p>

      <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        <strong className="text-[var(--foreground)]">Nobody receives these tokens</strong>
        {" — "}
        {recipientDisclaimer}. They&apos;re removed from the total supply permanently.
      </p>

      <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        In return: {outcome}.
      </p>

      <p className="mt-2 text-sm font-bold text-[var(--foreground)]">
        This cannot be undone, reversed, or refunded.
      </p>

      <label className="mt-4 flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
          className="mt-0.5 cursor-pointer"
        />
        <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
          I understand these tokens will be destroyed and cannot be recovered.
        </span>
      </label>

      <div className="mt-4 flex gap-2">
        <button type="button" onClick={onBack} disabled={busy} className="btn-brutal text-sm cursor-pointer">
          Back
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={!acknowledged || busy}
          className="btn-brutal btn-brutal-primary btn-notched flex-1 text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {busy ? (
            <>
              <CircleNotch size={16} className="animate-spin" aria-hidden="true" /> Burning...
            </>
          ) : (
            <>
              {/* Name the destructive act, not "Confirm". */}
              <Fire weight="fill" size={16} aria-hidden="true" /> Burn {formatTokenCount(tokenAmount)} $VIBE
            </>
          )}
        </button>
      </div>
    </div>
  );
}
