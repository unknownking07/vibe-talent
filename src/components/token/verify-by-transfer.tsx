"use client";

import { useState } from "react";
import { CircleNotch, SealCheck, Copy, Check } from "@phosphor-icons/react";

/**
 * The fallback ownership proof, for builders who will not connect a deployer
 * wallet to a website.
 *
 * Collapsed by default and worded as the second option throughout: signing a
 * message cannot move funds and broadcasting a transaction can, so the
 * connect-and-sign path above stays the recommendation. Someone who opens this
 * has already decided not to take it.
 */
export function VerifyByTransfer({
  onLinked,
}: {
  onLinked?: (address: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [memo, setMemo] = useState<string | null>(null);
  const [signature, setSignature] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linked, setLinked] = useState<string | null>(null);

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
    } catch {
      setError("Couldn't start verification. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/wallet/verify-transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signature: signature.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't verify that transaction.");
        return;
      }
      setLinked(data.address);
      onLinked?.(data.address);
    } catch {
      setError("Couldn't verify that transaction. Please try again.");
    } finally {
      setBusy(false);
    }
  }

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
        Prove the wallet without connecting it. You send a transaction{" "}
        <strong className="text-[var(--foreground)]">to your own wallet</strong>{" "}
        carrying the memo below, then paste the signature. Nothing is sent to
        VibeTalent, and no approval is granted.
      </p>

      {!memo ? (
        <button
          type="button"
          onClick={start}
          disabled={busy}
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
            className="mt-2 text-[11px]"
            style={{ color: "var(--text-muted)" }}
          >
            Valid for 15 minutes. Send from the wallet you want to prove.
          </p>

          <label
            htmlFor="transfer-signature"
            className="mt-3 block text-[11px] font-semibold"
            style={{ color: "var(--text-secondary)" }}
          >
            Transaction signature
          </label>
          <input
            id="transfer-signature"
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
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
            onClick={verify}
            disabled={busy || !signature.trim()}
            className="btn-brutal btn-brutal-dark mt-3 inline-flex items-center gap-2 px-4 py-2 text-xs disabled:opacity-50"
          >
            {busy ? <CircleNotch size={13} className="animate-spin" /> : null}
            Verify ownership
          </button>
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
    </div>
  );
}
