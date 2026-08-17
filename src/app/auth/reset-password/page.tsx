"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle, Lock } from "@phosphor-icons/react";
import { AuthShell, AuthHeader, AuthPrimaryButton } from "@/components/auth/auth-shell";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [sessionReady, setSessionReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Supabase will exchange the hash fragment for a session automatically
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setSessionReady(true);
      }
    });
    // Also check if we already have a session
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setSessionReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
    } else {
      setSuccess(true);
      setTimeout(() => router.push("/dashboard"), 2000);
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="mx-auto max-w-md px-4 sm:px-6 py-24 text-center">
        <CheckCircle weight="fill" size={56} className="mx-auto mb-5" style={{ color: "#16A34A" }} />
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Password updated</h1>
        <p className="mt-3 text-sm text-[var(--text-secondary)] font-medium">
          Your password has been reset. Redirecting to dashboard...
        </p>
      </div>
    );
  }

  return (
    <AuthShell>
      <AuthHeader title="Set new password" subtitle="Choose a new password for your account" />

      {!sessionReady && (
        <div
          className="p-3 mb-4 text-sm font-semibold text-[var(--status-warning-text)] rounded-xl"
          style={{ backgroundColor: "var(--status-warning-bg)", border: "1px solid var(--border-subtle)" }}
        >
          Verifying reset link... If this persists, request a new link.
        </div>
      )}

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
            New Password
          </label>
          <div className="relative">
            <Lock weight="fill" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="input-brutal" style={{ paddingLeft: "2.5rem" }}
              required
              minLength={6}
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-[var(--text-muted)] mb-1.5 block">
            Confirm Password
          </label>
          <div className="relative">
            <Lock weight="fill" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat your password"
              className="input-brutal" style={{ paddingLeft: "2.5rem" }}
              required
              minLength={6}
            />
          </div>
        </div>

        <AuthPrimaryButton type="submit" disabled={loading || !sessionReady}>
          {loading ? "Updating..." : "Update Password"}
        </AuthPrimaryButton>
      </form>

      <div className="mt-6 text-center">
        <Link href="/auth/forgot-password" className="text-sm font-semibold text-[var(--accent)] hover:underline">
          Request a new reset link
        </Link>
      </div>
    </AuthShell>
  );
}
