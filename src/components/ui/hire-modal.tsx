"use client";

import { useState, useEffect } from "react";
import { X, Send, CheckCircle, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface HireModalProps {
  builderId: string;
  builderName: string;
  isOpen: boolean;
  onClose: () => void;
}

const BUDGET_OPTIONS = [
  "Under $500",
  "$500-$1,000",
  "$1,000-$5,000",
  "$5,000+",
  "Let's discuss",
];

import { BLOCKED_DOMAINS, EMAIL_REGEX, NAME_REGEX } from "@/lib/validation";

export function HireModal({ builderId, builderName, isOpen, onClose }: HireModalProps) {
  const [form, setForm] = useState({
    sender_name: "",
    sender_email: "",
    budget: "",
    message: "",
  });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [loggedInUser, setLoggedInUser] = useState<{ name: string; email: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    // Check if user is logged in and auto-fill their info
    const checkAuth = async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabase = createClient() as any;
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const email = user.email || "";
        const name =
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.user_metadata?.user_name ||
          "";
        // Also check if they have a profile
        const { data: profile } = await supabase
          .from("users")
          .select("display_name, username")
          .eq("id", user.id)
          .single();
        const displayName = profile?.display_name || name || profile?.username || "";
        setLoggedInUser({ name: displayName, email });
        setForm((prev) => ({
          ...prev,
          sender_name: displayName,
          sender_email: email,
        }));
      }
    };
    checkAuth();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!form.sender_name || !form.sender_email || !form.message) {
      setError("Please fill in all required fields.");
      return;
    }
    // Name validation: min 2 chars, letters and spaces only
    const nameClean = form.sender_name.trim();
    if (nameClean.length < 2 || !NAME_REGEX.test(nameClean)) {
      setError("Please enter a valid name (letters only, at least 2 characters).");
      return;
    }
    // Email validation - strict
    const emailClean = form.sender_email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(emailClean)) {
      setError("Please enter a valid email address.");
      return;
    }
    // Block disposable emails
    const emailDomain = emailClean.split("@")[1];
    if (BLOCKED_DOMAINS.includes(emailDomain)) {
      setError("Please use a real email address, not a disposable one.");
      return;
    }
    // Block obviously fake emails
    if (emailDomain.length < 4 || !emailDomain.includes(".")) {
      setError("Please enter a valid email address.");
      return;
    }
    // Message validation: min 20 chars
    if (form.message.trim().length < 20) {
      setError("Please write a more detailed message (at least 20 characters).");
      return;
    }
    setError("");
    setSending(true);

    try {
      const res = await fetch("/api/hire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          builder_id: builderId,
          sender_name: nameClean,
          sender_email: emailClean,
          message: form.message.trim(),
          budget: form.budget || null,
        }),
      });

      if (!res.ok) {
        const resData = await res.json();
        setError(resData.error || "Failed to send request.");
        setSending(false);
        return;
      }

      const resData = await res.json();
      setRequestId(resData.id || null);
      setSent(true);
      setSending(false);
    } catch {
      setError("Something went wrong. Please try again.");
      setSending(false);
    }
  };

  const handleClose = () => {
    setSent(false);
    setRequestId(null);
    setForm({ sender_name: loggedInUser?.name || "", sender_email: loggedInUser?.email || "", budget: "", message: "" });
    setError("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto"
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "2px solid var(--border-hard)",
          boxShadow: "var(--shadow-brutal-sm)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-5"
          style={{
            borderBottom: "2px solid var(--border-hard)",
          }}
        >
          <h2 className="text-lg font-extrabold uppercase tracking-tight text-[var(--foreground)]">
            Hire @{builderName}
          </h2>
          <button
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center text-[var(--foreground)] transition-all hover:bg-[var(--bg-surface-light)]"
            style={{
              border: "2px solid var(--border-hard)",
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          {sent ? (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <div
                className="w-16 h-16 flex items-center justify-center"
                style={{
                  backgroundColor: "var(--status-success-bg)",
                  border: "2px solid var(--border-hard)",
                  boxShadow: "var(--shadow-brutal-sm)",
                }}
              >
                <CheckCircle size={32} className="text-[var(--status-success-text)]" />
              </div>
              <h3 className="text-xl font-extrabold uppercase text-[var(--foreground)]">Request Sent!</h3>
              <p className="text-sm text-[var(--text-secondary)] font-medium">
                Your hire request has been sent to @{builderName}. They will get back to you soon.
              </p>
              {requestId && (
                <div
                  className="w-full p-3 text-sm"
                  style={{
                    backgroundColor: "var(--bg-surface-light)",
                    border: "2px solid var(--border-hard)",
                  }}
                >
                  <p className="font-bold text-[var(--foreground)] mb-1">Continue the conversation:</p>
                  <a
                    href={`/hire/chat/${requestId}`}
                    className="text-[var(--accent)] font-extrabold underline underline-offset-2 break-all"
                  >
                    {typeof window !== "undefined" ? window.location.origin : ""}/hire/chat/{requestId}
                  </a>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                    Bookmark this link to check for replies and continue chatting.
                  </p>
                </div>
              )}
              <button
                onClick={handleClose}
                className="btn-brutal btn-brutal-primary text-sm mt-2"
              >
                Done
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {error && (
                <div
                  className="p-3 text-sm font-bold text-[var(--status-error-text)]"
                  style={{
                    backgroundColor: "var(--status-error-border)",
                    border: "2px solid var(--border-hard)",
                  }}
                >
                  {error}
                </div>
              )}

              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-1.5 block">
                  Your Name * {loggedInUser && <Lock size={10} className="inline ml-1" />}
                </label>
                <input
                  type="text"
                  value={form.sender_name}
                  onChange={(e) => !loggedInUser && setForm({ ...form, sender_name: e.target.value })}
                  placeholder="John Doe"
                  className="input-brutal"
                  readOnly={!!loggedInUser}
                  style={loggedInUser ? { backgroundColor: "var(--bg-surface-light)", cursor: "not-allowed" } : {}}
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-1.5 block">
                  Your Email * {loggedInUser && <Lock size={10} className="inline ml-1" />}
                </label>
                <input
                  type="email"
                  value={form.sender_email}
                  onChange={(e) => !loggedInUser && setForm({ ...form, sender_email: e.target.value })}
                  placeholder="john@example.com"
                  className="input-brutal"
                  readOnly={!!loggedInUser}
                  style={loggedInUser ? { backgroundColor: "var(--bg-surface-light)", cursor: "not-allowed" } : {}}
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-1.5 block">
                  Budget
                </label>
                <select
                  value={form.budget}
                  onChange={(e) => setForm({ ...form, budget: e.target.value })}
                  className="input-brutal cursor-pointer"
                >
                  <option value="">Select a budget range</option>
                  {BUDGET_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-1.5 block">
                  Message *
                </label>
                <textarea
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder="Tell them about your project, timeline, and what you're looking for..."
                  rows={4}
                  className="input-brutal resize-none"
                />
              </div>

              <button
                onClick={handleSubmit}
                disabled={sending || !form.sender_name || !form.sender_email || !form.message}
                className="btn-brutal btn-brutal-primary w-full justify-center text-sm flex items-center gap-2 disabled:opacity-50"
              >
                <Send size={16} />
                {sending ? "Sending..." : "Send Hire Request"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
