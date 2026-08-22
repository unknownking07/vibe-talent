"use client";

import { useState, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { Fire, CircleNotch, ArrowSquareOut } from "@phosphor-icons/react";
import { VOUCH } from "@/lib/vibe-config";
import { vouchPoints, voucherCredibility } from "@/lib/vouch";
import { BurnProvider, PRIVY_CONFIGURED } from "./burn-provider";
import { BurnConfirm } from "./burn-confirm";
import { useBurnFlow, type BurnQuote } from "./use-burn-flow";

type Props = {
  viewerId: string;
  viewerVibeScore: number;
  builderUsername: string;
  builderId: string;
  onVouched?: () => void;
};

export function VouchButton(props: Props) {
  if (!PRIVY_CONFIGURED) return null;
  return (
    <BurnProvider>
      <Body {...props} />
    </BurnProvider>
  );
}

function Body({
  viewerId,
  viewerVibeScore,
  builderUsername,
  builderId,
  onVouched,
}: Props) {
  const { login, authenticated, connectWallet } = usePrivy();
  const { wallet, busy, status, setStatus, quote, burn } = useBurnFlow();
  const [step, setStep] = useState<"idle" | "amount" | "confirm" | "done">(
    "idle",
  );
  const [usd, setUsd] = useState<number>(VOUCH.presetsUsd[1]);
  const [q, setQ] = useState<BurnQuote | null>(null);
  const [sig, setSig] = useState<string | null>(null);

  const points = vouchPoints(usd, viewerVibeScore);
  const belowFloor = voucherCredibility(viewerVibeScore) === 0;
  // Past this, extra dollars buy no additional score — say so rather than
  // letting someone overspend expecting more.
  const atCap = points >= VOUCH.perVoucherCapPoints;

  useEffect(() => {
    if (step !== "amount" && step !== "confirm") return;
    let cancelled = false;
    quote(usd)
      .then((v) => !cancelled && setQ(v))
      .catch(() => !cancelled && setQ(null));
    return () => {
      cancelled = true;
    };
  }, [usd, step, quote]);

  async function confirm() {
    if (!q) return;
    try {
      const { signature } = await burn({
        action: { kind: "vouch", actorId: viewerId, targetId: builderId },
        amount: q.amount,
        endpoint: "/api/vouch",
        body: { builder_username: builderUsername, usd },
      });
      setSig(signature);
      setStep("done");
      setStatus({ msg: `You backed @${builderUsername}.`, type: "success" });
      onVouched?.();
    } catch (e) {
      setStatus({
        msg: e instanceof Error ? e.message : "That burn failed.",
        type: "error",
      });
      setStep("amount");
    }
  }

  if (step === "done") {
    return (
      <div className="card-brutal p-4">
        <p className="text-sm font-bold text-[var(--foreground)]">
          You backed @{builderUsername}. Your burn is permanent.
        </p>
        {sig && (
          <a
            href={`https://solscan.io/tx/${sig}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs font-bold hover:underline"
            style={{ color: "var(--accent)" }}
          >
            View the burn on Solscan{" "}
            <ArrowSquareOut size={12} aria-hidden="true" />
          </a>
        )}
      </div>
    );
  }

  if (step === "idle") {
    return (
      <button
        type="button"
        onClick={() => {
          if (!wallet) {
            if (authenticated)
              connectWallet({ walletChainType: "solana-only" });
            else login({ walletChainType: "solana-only" });
            return;
          }
          setStep("amount");
        }}
        className="btn-brutal btn-brutal-primary btn-notched text-sm inline-flex items-center gap-2 cursor-pointer"
      >
        <Fire weight="fill" size={16} aria-hidden="true" /> Back @
        {builderUsername}
      </button>
    );
  }

  return (
    <div className="card-brutal p-4">
      {step === "amount" && (
        <>
          <h3 className="text-sm font-extrabold uppercase text-[var(--foreground)]">
            Burn $VIBE to back @{builderUsername}
          </h3>

          <div className="mt-3 flex flex-wrap gap-2">
            {VOUCH.presetsUsd.map((v) => {
              const active = usd === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setUsd(v)}
                  aria-pressed={active}
                  className="px-3 py-1.5 text-xs font-extrabold transition-colors cursor-pointer"
                  style={{
                    borderRadius: "var(--radius-chip)",
                    border: `1px solid ${active ? "var(--accent)" : "var(--border-subtle)"}`,
                    backgroundColor: active
                      ? "color-mix(in srgb, var(--accent) 14%, var(--bg-surface))"
                      : "var(--bg-surface)",
                    color: active
                      ? "var(--foreground)"
                      : "var(--text-secondary)",
                  }}
                >
                  ${v}
                </button>
              );
            })}
          </div>

          <p
            className="mt-3 text-xs font-medium"
            style={{ color: "var(--text-secondary)" }}
          >
            {q ? (
              <>
                ${usd.toFixed(2)} ≈{" "}
                <strong className="font-mono text-[var(--foreground)]">
                  {q.wholeTokens.toLocaleString("en-US", {
                    maximumFractionDigits: 0,
                  })}{" "}
                  $VIBE
                </strong>
              </>
            ) : (
              "Pricing..."
            )}
          </p>

          {belowFloor ? (
            <p
              className="mt-2 text-xs leading-relaxed"
              style={{ color: "var(--text-muted)" }}
            >
              Your vouch will show publicly on their profile, but won&apos;t add
              to their score until your own vibe score reaches{" "}
              {VOUCH.voucherMinVibeScore}.
            </p>
          ) : (
            <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
              Gives @{builderUsername}{" "}
              <strong className="text-[var(--accent)]">+{points}</strong> vibe
              score.
              {atCap
                ? " Score contribution caps here — more $VIBE won't add more."
                : ""}
            </p>
          )}

          {status?.type === "error" && (
            <p
              role="alert"
              className="mt-2 text-xs font-bold"
              style={{ color: "var(--status-error-text)" }}
            >
              {status.msg}
            </p>
          )}

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setStep("idle")}
              className="btn-brutal text-sm cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setStep("confirm")}
              disabled={!q || busy}
              className="btn-brutal btn-brutal-primary btn-notched flex-1 text-sm inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {busy ? (
                <CircleNotch
                  size={16}
                  className="animate-spin"
                  aria-hidden="true"
                />
              ) : null}
              Continue
            </button>
          </div>
        </>
      )}

      {step === "confirm" && q && (
        <>
          <BurnConfirm
            tokenAmount={q.wholeTokens}
            usdAmount={q.usd}
            outcome={
              belowFloor
                ? `you appear publicly as a backer on @${builderUsername}'s profile`
                : `@${builderUsername} gets +${points} vibe score, and you appear publicly as a backer on their profile`
            }
            recipientDisclaimer={`not VibeTalent, not @${builderUsername}`}
            busy={busy}
            onConfirm={confirm}
            onBack={() => setStep("amount")}
          />
          {status && status.type !== "success" && (
            <p
              role={status.type === "error" ? "alert" : "status"}
              aria-live="polite"
              className="mt-2 text-xs font-bold"
              style={{
                color:
                  status.type === "error"
                    ? "var(--status-error-text)"
                    : "var(--text-secondary)",
              }}
            >
              {status.msg}
            </p>
          )}
        </>
      )}
    </div>
  );
}
