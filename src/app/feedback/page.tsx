"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const REASONS = [
  { value: "not_useful", label: "Didn't find it useful" },
  { value: "confusing", label: "Too confusing to use" },
  { value: "no_time", label: "Just got busy / no time" },
  { value: "missing_features", label: "Missing features I need" },
  { value: "found_alternative", label: "Using something else" },
  { value: "other", label: "Other" },
];

function FeedbackForm() {
  const searchParams = useSearchParams();
  const username = searchParams.get("u") || "";

  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [wouldReturn, setWouldReturn] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) return;

    setSubmitting(true);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          reason,
          details,
          would_return: wouldReturn,
        }),
      });
      setSubmitted(true);
    } catch {
      // Still show success — we don't want to frustrate them
      setSubmitted(true);
    }
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--bg-base)" }}>
        <div
          className="w-full max-w-lg p-8 text-center"
          style={{
            backgroundColor: "var(--bg-surface)",
            border: "2px solid var(--border-hard)",
            boxShadow: "var(--shadow-brutal)",
          }}
        >
          <div className="text-4xl mb-4">🙏</div>
          <h1 className="text-2xl font-extrabold text-[var(--foreground)] mb-3">
            Thanks for your honesty
          </h1>
          <p className="text-[var(--text-muted)] mb-6">
            Your feedback directly shapes what we build next. We genuinely appreciate you taking the time.
          </p>
          <a
            href="/dashboard"
            className="inline-block px-6 py-3 font-bold text-sm text-white"
            style={{
              background: "var(--accent)",
              border: "2px solid var(--border-hard)",
              boxShadow: "var(--shadow-brutal)",
            }}
          >
            Back to VibeTalent
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--bg-base)" }}>
      <div
        className="w-full max-w-lg p-8"
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "2px solid var(--border-hard)",
          boxShadow: "var(--shadow-brutal)",
        }}
      >
        <h1 className="text-2xl font-extrabold text-[var(--foreground)] mb-2">
          Quick feedback
        </h1>
        <p className="text-sm text-[var(--text-muted)] mb-6">
          No guilt trip — we just want to build something you'd actually use. Takes 30 seconds.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Reason */}
          <div>
            <label className="block text-sm font-bold text-[var(--foreground)] mb-2">
              What made you stop using VibeTalent?
            </label>
            <div className="space-y-2">
              {REASONS.map((r) => (
                <label
                  key={r.value}
                  className="flex items-center gap-3 p-3 cursor-pointer transition-colors"
                  style={{
                    border: reason === r.value ? "2px solid var(--accent)" : "2px solid var(--border-subtle)",
                    background: reason === r.value ? "var(--accent-muted, rgba(255,58,0,0.05))" : "transparent",
                  }}
                >
                  <input
                    type="radio"
                    name="reason"
                    value={r.value}
                    checked={reason === r.value}
                    onChange={(e) => setReason(e.target.value)}
                    className="accent-[var(--accent)]"
                  />
                  <span className="text-sm text-[var(--foreground)]">{r.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Details */}
          <div>
            <label className="block text-sm font-bold text-[var(--foreground)] mb-2">
              What's the #1 thing that would bring you back?
              <span className="font-normal text-[var(--text-muted)]"> (optional)</span>
            </label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Be brutally honest — it helps us more than you think"
              rows={3}
              className="w-full px-3 py-2 text-sm bg-transparent text-[var(--foreground)] placeholder:text-[var(--text-muted)] resize-none"
              style={{ border: "2px solid var(--border-subtle)" }}
            />
          </div>

          {/* Would return */}
          <div>
            <label className="block text-sm font-bold text-[var(--foreground)] mb-2">
              Would you try VibeTalent again if we fixed this?
            </label>
            <div className="flex gap-2">
              {["Yes", "Maybe", "No"].map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setWouldReturn(opt.toLowerCase())}
                  className="flex-1 py-2 text-sm font-bold transition-colors"
                  style={{
                    border: wouldReturn === opt.toLowerCase() ? "2px solid var(--accent)" : "2px solid var(--border-subtle)",
                    background: wouldReturn === opt.toLowerCase() ? "var(--accent)" : "transparent",
                    color: wouldReturn === opt.toLowerCase() ? "#FFFFFF" : "var(--foreground)",
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={!reason || submitting}
            className="w-full py-3 font-bold text-sm text-white disabled:opacity-50"
            style={{
              background: "var(--accent)",
              border: "2px solid var(--border-hard)",
              boxShadow: "var(--shadow-brutal)",
            }}
          >
            {submitting ? "Sending..." : "Send Feedback"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function FeedbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-base)" }}>
          <div className="text-[var(--text-muted)]">Loading...</div>
        </div>
      }
    >
      <FeedbackForm />
    </Suspense>
  );
}
