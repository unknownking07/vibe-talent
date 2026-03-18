"use client";

import { useState } from "react";
import { X, Send, CheckCircle } from "lucide-react";

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

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!form.sender_name || !form.sender_email || !form.message) {
      setError("Please fill in all required fields.");
      return;
    }
    // Name validation: min 2 chars, letters and spaces only
    const nameClean = form.sender_name.trim();
    if (nameClean.length < 2 || !/^[a-zA-Z\s'-]+$/.test(nameClean)) {
      setError("Please enter a valid name (letters only, at least 2 characters).");
      return;
    }
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.sender_email.trim())) {
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
          sender_name: form.sender_name,
          sender_email: form.sender_email,
          message: form.message,
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
    setForm({ sender_name: "", sender_email: "", budget: "", message: "" });
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
          backgroundColor: "#FFFFFF",
          border: "2px solid #0F0F0F",
          boxShadow: "4px 4px 0 #000",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-5"
          style={{
            borderBottom: "2px solid #0F0F0F",
          }}
        >
          <h2 className="text-lg font-extrabold uppercase tracking-tight text-[#0F0F0F]">
            Hire @{builderName}
          </h2>
          <button
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center text-[#0F0F0F] transition-all hover:bg-[#F4F4F5]"
            style={{
              border: "2px solid #0F0F0F",
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
                  backgroundColor: "#D1FAE5",
                  border: "2px solid #0F0F0F",
                  boxShadow: "4px 4px 0 #000",
                }}
              >
                <CheckCircle size={32} className="text-[#065F46]" />
              </div>
              <h3 className="text-xl font-extrabold uppercase text-[#0F0F0F]">Request Sent!</h3>
              <p className="text-sm text-[#52525B] font-medium">
                Your hire request has been sent to @{builderName}. They will get back to you soon.
              </p>
              {requestId && (
                <div
                  className="w-full p-3 text-sm"
                  style={{
                    backgroundColor: "#EFF6FF",
                    border: "2px solid #0F0F0F",
                  }}
                >
                  <p className="font-bold text-[#0F0F0F] mb-1">Continue the conversation:</p>
                  <a
                    href={`/hire/chat/${requestId}`}
                    className="text-[var(--accent)] font-extrabold underline underline-offset-2 break-all"
                  >
                    {typeof window !== "undefined" ? window.location.origin : ""}/hire/chat/{requestId}
                  </a>
                  <p className="text-xs text-[#52525B] mt-1">
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
                  className="p-3 text-sm font-bold text-[#991B1B]"
                  style={{
                    backgroundColor: "#FEE2E2",
                    border: "2px solid #0F0F0F",
                  }}
                >
                  {error}
                </div>
              )}

              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-[#71717A] mb-1.5 block">
                  Your Name *
                </label>
                <input
                  type="text"
                  value={form.sender_name}
                  onChange={(e) => setForm({ ...form, sender_name: e.target.value })}
                  placeholder="John Doe"
                  className="input-brutal"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-[#71717A] mb-1.5 block">
                  Your Email *
                </label>
                <input
                  type="email"
                  value={form.sender_email}
                  onChange={(e) => setForm({ ...form, sender_email: e.target.value })}
                  placeholder="john@example.com"
                  className="input-brutal"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-[#71717A] mb-1.5 block">
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
                <label className="text-xs font-bold uppercase tracking-wide text-[#71717A] mb-1.5 block">
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
