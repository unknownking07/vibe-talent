"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Flame, Github, Mail, Lock, Megaphone } from "lucide-react";
import OAuthConsentModal from "@/components/auth/oauth-consent-modal";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [consentProvider, setConsentProvider] = useState<"github" | "google" | null>(null);
  const searchParams = useSearchParams();
  const reason = searchParams.get("reason");
  const redirectTo = searchParams.get("redirect") || "/dashboard";
  const authErrorCode = searchParams.get("error_code");
  const authErrorDescription = searchParams.get("error_description");

  // Redirect already-authenticated users to dashboard
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        window.location.href = "/dashboard";
      }
    });
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      // Full reload to clear stale router cache and pick up fresh auth state
      window.location.href = redirectTo;
    }
  };

  const handleGitHubLogin = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  const handleGoogleLogin = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  return (
    <div className="mx-auto max-w-md px-4 sm:px-6 py-20">
      <div className="text-center mb-8">
        <div
          className="inline-flex items-center justify-center w-14 h-14 mb-4"
          style={{
            backgroundColor: "var(--accent)",
            border: "2px solid var(--border-hard)",
            boxShadow: "var(--shadow-brutal-sm)",
          }}
        >
          <Flame size={28} className="text-white" />
        </div>
        <h1 className="text-3xl font-extrabold uppercase text-[var(--foreground)]">Welcome Back</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)] font-medium">
          Sign in to your VibeTalent account
        </p>
      </div>

      {authErrorCode === "identity_already_exists" && (
        <div
          className="mb-4 p-4 flex items-start gap-3"
          style={{
            backgroundColor: "var(--status-error-bg)",
            border: "2px solid var(--border-hard)",
            boxShadow: "var(--shadow-brutal-sm)",
          }}
        >
          <Mail size={18} className="mt-0.5 shrink-0" style={{ color: "var(--status-error-text)" }} />
          <div className="text-sm font-bold text-[var(--foreground)]">
            <p>An account with this email already exists.</p>
            <p className="mt-1 font-medium text-[var(--text-secondary)]">
              Sign in with your original method (email/password or Google), then connect GitHub from{" "}
              <Link href="/settings" className="text-[var(--accent)] hover:underline">Settings</Link>.
            </p>
          </div>
        </div>
      )}

      {authErrorCode && authErrorCode !== "identity_already_exists" && (
        <div
          className="mb-4 p-4 flex items-start gap-3"
          style={{
            backgroundColor: "var(--status-error-bg)",
            border: "2px solid var(--border-hard)",
            boxShadow: "var(--shadow-brutal-sm)",
          }}
        >
          <Mail size={18} className="mt-0.5 shrink-0" style={{ color: "var(--status-error-text)" }} />
          <p className="text-sm font-bold text-[var(--foreground)]">
            {authErrorDescription || "Authentication failed. Please try again."}
          </p>
        </div>
      )}

      {reason === "promote" && (
        <div
          className="mb-4 p-4 flex items-start gap-3"
          style={{
            backgroundColor: "var(--bg-surface)",
            border: "2px solid var(--accent)",
            boxShadow: "var(--shadow-brutal-sm)",
          }}
        >
          <Megaphone size={18} className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }} />
          <p className="text-sm font-bold text-[var(--foreground)]">
            Sign in to promote your project on the VibeTalent homepage. It only takes a few seconds!
          </p>
        </div>
      )}

      <div
        className="p-6 space-y-5"
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "2px solid var(--border-hard)",
          boxShadow: "var(--shadow-brutal)",
        }}
      >
        <div className="space-y-3">
          <button
            onClick={() => setConsentProvider("github")}
            className="w-full flex items-center justify-center gap-2 px-5 py-4 text-sm font-extrabold uppercase tracking-wide text-white cursor-pointer transition-colors hover:bg-[#E03300]"
            style={{
              backgroundColor: "var(--accent)",
              border: "2px solid var(--border-hard)",
              boxShadow: "var(--shadow-brutal-sm)",
            }}
          >
            <Github size={18} />
            Continue with GitHub
          </button>
          <p className="text-[10px] font-bold uppercase text-center text-[var(--text-muted)] tracking-wide">
            Recommended — auto-verifies your GitHub and syncs your streak
          </p>

          <button
            onClick={() => setConsentProvider("google")}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 text-sm font-extrabold uppercase tracking-wide text-[var(--foreground)] cursor-pointer transition-colors hover:bg-[var(--bg-surface-light)]"
            style={{
              backgroundColor: "var(--bg-surface)",
              border: "2px solid var(--border-hard)",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Continue with Google
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-[2px] bg-[var(--bg-inverted)]" />
          <span className="text-xs font-bold uppercase text-[var(--text-muted)]">Or</span>
          <div className="flex-1 h-[2px] bg-[var(--bg-inverted)]" />
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-1.5 block">
              Email
            </label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
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

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">
                Password
              </label>
              <Link href="/auth/forgot-password" className="text-xs font-bold text-[var(--accent)] hover:underline">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                className="input-brutal" style={{ paddingLeft: "2.5rem" }}
                required
              />
            </div>
          </div>

          {error && (
            <div
              className="p-3 text-sm font-bold text-[var(--status-error-text)]"
              style={{
                backgroundColor: "var(--status-error-bg)",
                border: "2px solid var(--border-hard)",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center px-5 py-3 text-sm font-extrabold uppercase tracking-wide text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:bg-[#E03300]"
            style={{
              backgroundColor: "var(--accent)",
              border: "2px solid var(--border-hard)",
            }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-sm font-medium text-[var(--text-secondary)]">
        Don&apos;t have an account?{" "}
        <Link href="/auth/signup" className="font-bold text-[var(--accent)] hover:underline uppercase">
          Sign Up
        </Link>
      </p>

      {consentProvider && (
        <OAuthConsentModal
          provider={consentProvider}
          onConfirm={() => {
            if (consentProvider === "github") handleGitHubLogin();
            else handleGoogleLogin();
            setConsentProvider(null);
          }}
          onCancel={() => setConsentProvider(null)}
        />
      )}
    </div>
  );
}
