"use client";

import { useState, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { Shield, CircleNotch, ArrowSquareOut } from "@phosphor-icons/react";
import { STREAK_PROTECT } from "@/lib/vibe-config";
import { BurnProvider, PRIVY_CONFIGURED } from "@/components/token/burn-provider";
import { BurnConfirm } from "@/components/token/burn-confirm";
import { useBurnFlow, type BurnQuote } from "@/components/token/use-burn-flow";

type Props = {
  userId: string;
  /** Streak that was lost, from users.streak_before_break. */
  lostStreak: number;
  /** users.streak_broken_at, ISO. */
  brokenAt: string;
  onRestored?: (streak: number) => void;
};

/**
 * Offers a paid restore for a streak broken inside the grace window.
 *
 * Rendered only when the server says a restore is actually available — the
 * eligibility rules live in the endpoint, and this card must never promise
 * something the API will reject.
 */
export function StreakProtectCard(props: Props) {
  if (!PRIVY_CONFIGURED) return null;
  return (
    <BurnProvider>
      <Body {...props} />
    </BurnProvider>
  );
}

function ymd(d: Date) {
  return d.toISOString().split("T")[0];
}

function Body({ userId, lostStreak, brokenAt, onRestored }: Props) {
  const { login, authenticated, connectWallet } = usePrivy();
  const { wallet, busy, status, setStatus, quote, burn } = useBurnFlow();
  const [step, setStep] = useState<"idle" | "confirm" | "done">("idle");
  const [q, setQ] = useState<BurnQuote | null>(null);
  const [restored, setRestored] = useState<number | null>(null);
  const [sig, setSig] = useState<string | null>(null);

  const breakDate = ymd(new Date(brokenAt));

  // Computed in an effect, not during render: reading the clock while
  // rendering is impure and would also make the server and client disagree on
  // the countdown at hydration. Re-ticks each minute so it stays honest.
  const [hoursLeft, setHoursLeft] = useState<number | null>(null);
  useEffect(() => {
    const deadline = new Date(brokenAt).getTime() + STREAK_PROTECT.graceHours * 3_600_000;
    const tick = () =>
      setHoursLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 3_600_000)));
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [brokenAt]);

  useEffect(() => {
    quote(STREAK_PROTECT.usdPrice).then(setQ).catch(() => setQ(null));
  }, [quote]);

  async function start() {
    if (!wallet) {
      if (authenticated) connectWallet({ walletChainType: "solana-only" });
      else login({ walletChainType: "solana-only" });
      return;
    }
    setStatus(null);
    setStep("confirm");
  }

  async function confirm() {
    if (!q) return;
    try {
      const { signature, result } = await burn({
        action: { kind: "protect", actorId: userId, breakDate },
        amount: q.amount,
        endpoint: "/api/streak/protect",
        body: { break_date: breakDate },
      });
      const streak = (result as { streak?: number })?.streak ?? lostStreak;
      setRestored(streak);
      setSig(signature);
      setStep("done");
      setStatus({ msg: `Your ${streak}-day streak is back.`, type: "success" });
      onRestored?.(streak);
    } catch (e) {
      setStatus({ msg: e instanceof Error ? e.message : "That burn failed.", type: "error" });
      setStep("idle");
    }
  }

  if (step === "done" && restored != null) {
    return (
      <div className="card-brutal p-4">
        <div className="flex items-center gap-2">
          <Shield weight="fill" size={18} style={{ color: "var(--accent)" }} aria-hidden="true" />
          <h3 className="text-sm font-extrabold uppercase text-[var(--foreground)]">
            {restored}-day streak restored
          </h3>
        </div>
        {sig && (
          <a
            href={`https://solscan.io/tx/${sig}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs font-bold hover:underline"
            style={{ color: "var(--accent)" }}
          >
            View the burn on Solscan <ArrowSquareOut size={12} aria-hidden="true" />
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="card-brutal p-4">
      <div className="flex items-center gap-2">
        <Shield weight="fill" size={18} style={{ color: "var(--accent)" }} aria-hidden="true" />
        <h3 className="text-sm font-extrabold uppercase text-[var(--foreground)]">
          Bring back your {lostStreak}-day streak
        </h3>
      </div>

      {step === "idle" && (
        <>
          <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            Burn about ${STREAK_PROTECT.usdPrice} of $VIBE to restore it.
            {q ? (
              <>
                {" "}
                That&apos;s{" "}
                <strong className="font-mono text-[var(--foreground)]">
                  {q.wholeTokens.toLocaleString("en-US", { maximumFractionDigits: 0 })} $VIBE
                </strong>{" "}
                right now.
              </>
            ) : null}
            {hoursLeft != null ? (
              <>
                {" "}
                <strong className="text-[var(--foreground)]">{hoursLeft}h left</strong> to decide.
              </>
            ) : null}{" "}
            Restored days stay marked on your heatmap.
          </p>

          {status?.type === "error" && (
            <p role="alert" className="mt-2 text-xs font-bold" style={{ color: "var(--status-error-text)" }}>
              {status.msg}
            </p>
          )}

          <button
            type="button"
            onClick={start}
            disabled={busy || !q}
            className="btn-brutal btn-brutal-primary btn-notched mt-3 text-sm inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {busy ? (
              <>
                <CircleNotch size={16} className="animate-spin" aria-hidden="true" /> Working...
              </>
            ) : !wallet ? (
              "Connect wallet to restore"
            ) : (
              "Restore my streak"
            )}
          </button>
        </>
      )}

      {step === "confirm" && q && (
        <div className="mt-3">
          <BurnConfirm
            tokenAmount={q.wholeTokens}
            usdAmount={q.usd}
            outcome={`your ${lostStreak}-day streak comes back, marked as restored on your heatmap`}
            recipientDisclaimer="not VibeTalent, not anyone else"
            busy={busy}
            onConfirm={confirm}
            onBack={() => setStep("idle")}
          />
          {status && status.type !== "success" && (
            <p
              role={status.type === "error" ? "alert" : "status"}
              aria-live="polite"
              className="mt-2 text-xs font-bold"
              style={{
                color:
                  status.type === "error" ? "var(--status-error-text)" : "var(--text-secondary)",
              }}
            >
              {status.msg}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
