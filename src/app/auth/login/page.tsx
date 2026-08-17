"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import OAuthConsentModal from "@/components/auth/oauth-consent-modal";
import {
  AuthShell,
  AuthHeader,
  AuthPrimaryButton,
  AuthSecondaryButton,
  AuthDivider,
  GoogleMark,
} from "@/components/auth/auth-shell";
import { Envelope, GithubLogo, Lock, Megaphone } from "@phosphor-icons/react";

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
    // Public-only OAuth (Supabase default). See the note in signup/page.tsx:
    // we intentionally don't request `repo` — read-only private access will
    // come from a GitHub App, not the all-or-nothing OAuth `repo` scope.
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
    <AuthShell>
      <AuthHeader title="Welcome back" subtitle="Sign in to your VibeTalent account" />

      {authErrorCode === "identity_already_exists" && (
        <div
          className="mb-6 p-4 flex items-start gap-3 rounded-xl"
          style={{ backgroundColor: "var(--status-error-bg)", border: "1px solid var(--status-error-border)" }}
        >
          <Envelope weight="fill" size={18} className="mt-0.5 shrink-0" style={{ color: "var(--status-error-text)" }} />
          <div className="text-sm font-semibold text-[var(--foreground)]">
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
          className="mb-6 p-4 flex items-start gap-3 rounded-xl"
          style={{ backgroundColor: "var(--status-error-bg)", border: "1px solid var(--status-error-border)" }}
        >
          <Envelope weight="fill" size={18} className="mt-0.5 shrink-0" style={{ color: "var(--status-error-text)" }} />
          <p className="text-sm font-semibold text-[var(--foreground)]">
            {authErrorDescription || "Authentication failed. Please try again."}
          </p>
        </div>
      )}

      {reason === "promote" && (
        <div
          className="mb-6 p-4 flex items-start gap-3 rounded-xl"
          style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--accent)" }}
        >
          <Megaphone weight="fill" size={18} className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }} />
          <p className="text-sm font-semibold text-[var(--foreground)]">
            Sign in to promote your project on the VibeTalent homepage. It only takes a few seconds!
          </p>
        </div>
      )}

      <div className="space-y-3">
        <AuthPrimaryButton onClick={() => setConsentProvider("github")}>
          <GithubLogo weight="fill" size={18} />
          Continue with GitHub
        </AuthPrimaryButton>
        <p className="text-[11px] font-medium text-center text-[var(--text-muted)]">
          Recommended: auto-verifies your GitHub and syncs your streak
        </p>
        <AuthSecondaryButton onClick={() => setConsentProvider("google")}>
          <GoogleMark />
          Continue with Google
        </AuthSecondaryButton>
      </div>

      <div className="my-6">
        <AuthDivider />
      </div>

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-[var(--text-muted)] mb-1.5 block">
            Email
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

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-[var(--text-muted)]">
              Password
            </label>
            <Link href="/auth/forgot-password" className="text-xs font-semibold text-[var(--accent)] hover:underline">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock weight="fill" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
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
            className="p-3 text-sm font-semibold text-[var(--status-error-text)] rounded-xl"
            style={{ backgroundColor: "var(--status-error-bg)", border: "1px solid var(--status-error-border)" }}
          >
            {error}
          </div>
        )}

        <AuthPrimaryButton type="submit" disabled={loading}>
          {loading ? "Signing in..." : "Sign In"}
        </AuthPrimaryButton>
      </form>

      <p className="mt-8 text-center text-sm font-medium text-[var(--text-secondary)]">
        Don&apos;t have an account?{" "}
        <Link href="/auth/signup" className="font-semibold text-[var(--accent)] hover:underline">
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
    </AuthShell>
  );
}
