"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CircleNotch, SealCheck, Copy, Check } from "@phosphor-icons/react";

/** How often to look for the builder's transaction, in ms. */
const POLL_INTERVAL_MS = 5_000;

/** Stop after this long so a forgotten tab is not polling an RPC forever. */
const POLL_LIMIT = 120;

/**
 * The fallback ownership proof, for builders who will not connect a deployer
 * wallet to a website.
 *
 * Placed second on purpose: signing a message cannot move funds and
 * broadcasting a transaction can, so connect-and-sign stays the recommendation
 * and someone opening this has already declined it.
 *
 * The flow is watched rather than pasted. The builder names the wallet, sends
 * one transaction to themselves carrying our memo, and this polls until it
 * appears. Naming the wallet grants nothing — the proof is still a signed
 * transaction carrying a challenge only this account was issued.
 */
export function VerifyByTransfer({
  onLinked,
}: {
  onLinked?: (address: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [address, setAddress] = useState("");
  const [memo, setMemo] = useState<string | null>(null);
  const [watching, setWatching] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [manualSignature, setManualSignature] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linked, setLinked] = useState<string | null>(null);

  const linkedRef = useRef(false);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/wallet/verify-transfer");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't start verification.");
        return;
      }
      setMemo(data.memo);
      setWatching(true);
    } catch {
      setError("Couldn't start verification. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  /** One look for the proof. Returns true once the wallet is linked. */
  const attempt = useCallback(
    async (payload: {
      address?: string;
      signature?: string;
    }): Promise<boolean> => {
      try {
        const res = await fetch("/api/wallet/verify-transfer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();

        if (res.ok) {
          linkedRef.current = true;
          setLinked(data.address);
          setWatching(false);
          onLinked?.(data.address);
          return true;
        }

        // 404 is "not there yet", which is the normal state while waiting.
        if (res.status !== 404)
          setError(data.error ?? "Couldn't verify that transaction.");
        return false;
      } catch {
        return false;
      }
    },
    [onLinked],
  );

  // Poll while watching. Cleared on unmount so a closed panel stops calling.
  useEffect(() => {
    if (!watching || !address.trim()) return;

    let cancelled = false;
    const timer = setInterval(async () => {
      if (cancelled || linkedRef.current) return;
      setAttempts((n) => {
        if (n + 1 >= POLL_LIMIT) setWatching(false);
        return n + 1;
      });
      await attempt({ address: address.trim() });
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [watching, address, attempt]);

  async function copyMemo() {
    if (!memo) return;
    try {
      await navigator.clipboard.writeText(memo);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be denied; the memo is selectable on screen.
    }
  }

  if (linked) {
    return (
      <p
        className="mt-3 flex items-center gap-2 text-xs"
        style={{ color: "var(--verified)" }}
      >
        <SealCheck size={14} weight="fill" />
        Verified {linked.slice(0, 6)}…{linked.slice(-4)} from your transaction.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 text-xs font-semibold underline underline-offset-2"
        style={{ color: "var(--text-muted)" }}
      >
        Can&apos;t or don&apos;t want to connect your wallet? Verify with a
        transaction instead
      </button>
    );
  }

  return (
    <div
      className="mt-3 rounded-xl p-4"
      style={{
        backgroundColor: "var(--bg-surface-light)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <p
        className="text-xs leading-relaxed"
        style={{ color: "var(--text-secondary)" }}
      >
        Prove the wallet without ever connecting it. Your wallet never talks to
        this site and we never ask it for anything — you send one transaction
        from wherever you normally sign, and we read it off the chain.
      </p>

      <ol
        className="mt-3 flex flex-col gap-1.5 text-[11px] leading-relaxed"
        style={{ color: "var(--text-muted)" }}
      >
        <li>
          <strong className="text-[var(--text-secondary)]">1.</strong> Tell us
          which wallet you want to prove.
        </li>
        <li>
          <strong className="text-[var(--text-secondary)]">2.</strong> From that
          wallet, send any amount{" "}
          <strong className="text-[var(--text-secondary)]">to itself</strong>{" "}
          with the memo we give you attached. Nothing comes to VibeTalent and no
          approval is granted.
        </li>
        <li>
          <strong className="text-[var(--text-secondary)]">3.</strong> We watch
          for it and verify you automatically.
        </li>
      </ol>

      <label
        htmlFor="prove-address"
        className="mt-4 block text-[11px] font-semibold"
        style={{ color: "var(--text-secondary)" }}
      >
        Wallet address
      </label>
      <input
        id="prove-address"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder="4EvnGaySWW6fhmQeTbjb…"
        spellCheck={false}
        disabled={Boolean(memo)}
        className="mt-1 w-full rounded-lg px-3 py-2 font-mono text-[11px] text-[var(--foreground)] disabled:opacity-60"
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
        }}
      />

      {!memo ? (
        <button
          type="button"
          onClick={start}
          disabled={busy || !address.trim()}
          className="btn-brutal btn-brutal-dark mt-3 inline-flex items-center gap-2 px-4 py-2 text-xs disabled:opacity-50"
        >
          {busy ? <CircleNotch size={13} className="animate-spin" /> : null}
          Get my memo
        </button>
      ) : (
        <>
          <div
            className="mt-3 flex items-center justify-between gap-2 rounded-lg px-3 py-2"
            style={{
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <code className="min-w-0 break-all font-mono text-[11px] text-[var(--foreground)]">
              {memo}
            </code>
            <button
              type="button"
              onClick={copyMemo}
              aria-label="Copy the verification memo"
              className="shrink-0 text-[var(--text-muted)] hover:text-[var(--foreground)]"
            >
              {copied ? <Check size={14} weight="bold" /> : <Copy size={14} />}
            </button>
          </div>

          <p
            className="mt-2 flex items-center gap-2 text-[11px]"
            style={{ color: "var(--text-muted)" }}
          >
            {watching ? (
              <>
                <CircleNotch size={12} className="animate-spin" />
                Watching for your transaction. Valid for 15 minutes.
              </>
            ) : (
              <>Stopped watching. Paste the signature below, or start again.</>
            )}
          </p>

          {!showManual ? (
            <button
              type="button"
              onClick={() => setShowManual(true)}
              className="mt-2 text-[11px] font-semibold underline underline-offset-2"
              style={{ color: "var(--text-muted)" }}
            >
              Already sent it? Paste the signature instead
            </button>
          ) : (
            <>
              <label
                htmlFor="transfer-signature"
                className="mt-3 block text-[11px] font-semibold"
                style={{ color: "var(--text-secondary)" }}
              >
                Transaction signature
              </label>
              <input
                id="transfer-signature"
                value={manualSignature}
                onChange={(e) => setManualSignature(e.target.value)}
                placeholder="5j7s6NiJS3JAkv…"
                spellCheck={false}
                className="mt-1 w-full rounded-lg px-3 py-2 font-mono text-[11px] text-[var(--foreground)]"
                style={{
                  backgroundColor: "var(--bg-surface)",
                  border: "1px solid var(--border-subtle)",
                }}
              />
              <button
                type="button"
                onClick={async () => {
                  setBusy(true);
                  setError(null);
                  await attempt({ signature: manualSignature.trim() });
                  setBusy(false);
                }}
                disabled={busy || !manualSignature.trim()}
                className="btn-brutal btn-brutal-dark mt-3 inline-flex items-center gap-2 px-4 py-2 text-xs disabled:opacity-50"
              >
                {busy ? (
                  <CircleNotch size={13} className="animate-spin" />
                ) : null}
                Verify ownership
              </button>
            </>
          )}
        </>
      )}

      {error ? (
        <p
          className="mt-2 text-[11px]"
          style={{ color: "var(--status-error-text)" }}
        >
          {error}
        </p>
      ) : null}

      {attempts > 0 && watching ? (
        <p
          className="mt-2 text-[10px]"
          style={{ color: "var(--text-muted-soft)" }}
        >
          Checked {attempts} {attempts === 1 ? "time" : "times"}.
        </p>
      ) : null}
    </div>
  );
}
