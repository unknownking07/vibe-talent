"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Lock, Check } from "lucide-react";
import { useRouter } from "next/navigation";

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

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div
          className="p-8"
          style={{
            backgroundColor: "var(--bg-surface)",
            border: "2px solid var(--border-hard)",
            boxShadow: "var(--shadow-brutal)",
          }}
        >
          {success ? (
            <div className="text-center">
              <div
                className="inline-flex items-center justify-center w-16 h-16 mb-4"
                style={{
                  backgroundColor: "#D1FAE5",
                  border: "2px solid var(--border-hard)",
                }}
              >
                <Check size={32} className="text-emerald-700" />
              </div>
              <h1 className="text-2xl font-extrabold uppercase text-[var(--foreground)]">Password Updated</h1>
              <p className="mt-3 text-sm text-[var(--text-secondary)] font-medium">
                Your password has been reset. Redirecting to dashboard...
              </p>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <div
                  className="inline-flex items-center justify-center w-16 h-16 mb-4"
                  style={{
                    backgroundColor: "var(--status-warning-bg)",
                    border: "2px solid var(--border-hard)",
                  }}
                >
                  <Lock size={32} className="text-[var(--accent)]" />
                </div>
                <h1 className="text-2xl font-extrabold uppercase text-[var(--foreground)]">Set New Password</h1>
                <p className="mt-2 text-sm text-[var(--text-secondary)] font-medium">
                  Choose a new password for your account
                </p>
              </div>

              {!sessionReady && (
                <div
                  className="p-3 mb-4 text-sm font-bold text-amber-800"
                  style={{ backgroundColor: "var(--status-warning-bg)", border: "2px solid var(--border-hard)" }}
                >
                  Verifying reset link... If this persists, request a new link.
                </div>
              )}

              {error && (
                <div
                  className="p-3 mb-4 text-sm font-bold text-red-800"
                  style={{ backgroundColor: "var(--status-error-border)", border: "2px solid var(--border-hard)" }}
                >
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-1.5 block">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="input-brutal"
                    required
                    minLength={6}
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-1.5 block">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat your password"
                    className="input-brutal"
                    required
                    minLength={6}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !sessionReady}
                  className="btn-brutal btn-brutal-primary w-full justify-center text-base disabled:opacity-50"
                >
                  {loading ? "Updating..." : "Update Password"}
                </button>
              </form>

              <div className="mt-4 text-center">
                <Link href="/auth/forgot-password" className="text-sm font-bold text-[var(--accent)] hover:underline">
                  Request a new reset link
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
