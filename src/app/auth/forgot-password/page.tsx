"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CheckCircle, Envelope } from "@phosphor-icons/react";
import { AuthShell, AuthHeader, AuthPrimaryButton } from "@/components/auth/auth-shell";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });

    if (resetError) {
      setError(resetError.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  };

  if (sent) {
    return (
      <div className="mx-auto max-w-md px-4 sm:px-6 py-24 text-center">
        <CheckCircle weight="fill" size={56} className="mx-auto mb-5" style={{ color: "#16A34A" }} />
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Check your email</h1>
        <p className="mt-3 text-sm text-[var(--text-secondary)] font-medium leading-relaxed">
          We sent a password reset link to <strong className="text-[var(--foreground)]">{email}</strong>. Click the
          link to set a new password.
        </p>
        <Link
          href="/auth/login"
          className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)] hover:underline"
        >
          <ArrowLeft size={14} />
          Back to Login
        </Link>
      </div>
    );
  }

  return (
    <AuthShell>
      <Link
        href="/auth/login"
        className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--accent)] mb-8"
      >
        <ArrowLeft size={14} />
        Back to Login
      </Link>

      <AuthHeader title="Forgot password" subtitle="Enter your email and we'll send you a reset link" />

      {error && (
        <div
          className="p-3 mb-4 text-sm font-semibold text-[var(--status-error-text)] rounded-xl"
          style={{ backgroundColor: "var(--status-error-bg)", border: "1px solid var(--status-error-border)" }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-[var(--text-muted)] mb-1.5 block">
            Email Address
          </label>
          <div className="relative">
            <Envelope weight="fill" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="input-brutal" style={{ paddingLeft: "2.5rem" }}
              required
            />
          </div>
        </div>

        <AuthPrimaryButton type="submit" disabled={loading}>
          {loading ? "Sending..." : "Send Reset Link"}
        </AuthPrimaryButton>
      </form>
    </AuthShell>
  );
}
