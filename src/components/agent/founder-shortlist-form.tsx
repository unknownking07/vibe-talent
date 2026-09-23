"use client";

import { useRef, useState } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import type { TaskRequest } from "@/lib/types/agent";
import { trackFunnelEvent } from "@/lib/funnel-events";

export function FounderShortlistForm({ brief }: { brief: TaskRequest }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setSending(true);
    setError("");
    trackFunnelEvent("founder_brief_submitted");

    try {
      const response = await fetch("/api/founder-briefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...brief, name, email, consent }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(typeof body?.error === "string" ? body.error : "Could not send your request. Try again.");
      }
      setSent(true);
      trackFunnelEvent("founder_brief_created");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not send your request. Try again.");
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div role="status" className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6">
        <CheckCircle2 size={24} className="text-[var(--accent)]" />
        <h2 className="mt-3 text-lg font-bold text-[var(--foreground)]">Request received</h2>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          We&apos;ll review your brief and email you if we can help with a relevant shortlist.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 sm:p-6">
      <h2 className="text-lg font-bold text-[var(--foreground)]">Want a human shortlist?</h2>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">
        We can review your brief and suggest builders with relevant shipped work. We confirm availability before introductions.
      </p>

      {!open ? (
        <button
          type="button"
          onClick={() => { setOpen(true); trackFunnelEvent("founder_shortlist_opened"); }}
          className="btn-brutal btn-brutal-primary mt-4 inline-flex items-center gap-2 text-sm"
        >
          Get a human shortlist <ArrowRight size={16} />
        </button>
      ) : (
        <form onSubmit={submit} className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-[var(--text-secondary)]">
              Your name
              <input
                required
                autoComplete="name"
                maxLength={100}
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="input-brutal mt-1.5 w-full"
              />
            </label>
            <label className="block text-xs font-semibold text-[var(--text-secondary)]">
              Email for follow-up
              <input
                required
                type="email"
                autoComplete="email"
                maxLength={254}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="input-brutal mt-1.5 w-full"
              />
            </label>
          </div>
          <label className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
            <input
              type="checkbox"
              required
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              className="mt-0.5 accent-[#FF3A00]"
            />
            <span>I agree that VibeTalent may email me about this project request. See our <Link href="/privacy" className="underline">privacy policy</Link>.</span>
          </label>
          {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={sending}
            className="btn-brutal btn-brutal-primary inline-flex items-center gap-2 text-sm disabled:opacity-60"
          >
            {sending ? "Sending..." : "Request shortlist"}
            {!sending && <ArrowRight size={16} />}
          </button>
        </form>
      )}
    </div>
  );
}
