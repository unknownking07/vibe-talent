"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Mail, ArrowLeft, Check } from "lucide-react";

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

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link
          href="/auth/login"
          className="inline-flex items-center gap-2 text-sm font-bold uppercase text-[#71717A] hover:text-[var(--accent)] mb-6"
        >
          <ArrowLeft size={14} />
          Back to Login
        </Link>

        <div
          className="p-8"
          style={{
            backgroundColor: "#FFFFFF",
            border: "2px solid #0F0F0F",
            boxShadow: "var(--shadow-brutal)",
          }}
        >
          {sent ? (
            <div className="text-center">
              <div
                className="inline-flex items-center justify-center w-16 h-16 mb-4"
                style={{
                  backgroundColor: "#D1FAE5",
                  border: "2px solid #0F0F0F",
                }}
              >
                <Check size={32} className="text-emerald-700" />
              </div>
              <h1 className="text-2xl font-extrabold uppercase text-[#0F0F0F]">Check Your Email</h1>
              <p className="mt-3 text-sm text-[#52525B] font-medium">
                We sent a password reset link to <strong>{email}</strong>. Click the link to set a new password.
              </p>
              <Link href="/auth/login" className="btn-brutal btn-brutal-secondary text-sm mt-6 inline-flex">
                Back to Login
              </Link>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <div
                  className="inline-flex items-center justify-center w-16 h-16 mb-4"
                  style={{
                    backgroundColor: "#FFF7ED",
                    border: "2px solid #0F0F0F",
                  }}
                >
                  <Mail size={32} className="text-[var(--accent)]" />
                </div>
                <h1 className="text-2xl font-extrabold uppercase text-[#0F0F0F]">Forgot Password</h1>
                <p className="mt-2 text-sm text-[#52525B] font-medium">
                  Enter your email and we&apos;ll send you a reset link
                </p>
              </div>

              {error && (
                <div
                  className="p-3 mb-4 text-sm font-bold text-red-800"
                  style={{ backgroundColor: "#FEE2E2", border: "2px solid #0F0F0F" }}
                >
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide text-[#71717A] mb-1.5 block">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="input-brutal"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-brutal btn-brutal-primary w-full justify-center text-base"
                >
                  {loading ? "Sending..." : "Send Reset Link"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
