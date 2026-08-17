"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import OAuthConsentModal from "@/components/auth/oauth-consent-modal";
import { normalizeUsernameInput } from "@/lib/username";
import {
  AuthShell,
  AuthHeader,
  AuthPrimaryButton,
  AuthSecondaryButton,
  AuthDivider,
  GoogleMark,
} from "@/components/auth/auth-shell";
import { CheckCircle, Envelope, GithubLogo, Lock, User } from "@phosphor-icons/react";

export default function SignUpPage() {
  const searchParams = useSearchParams();
  const ref = searchParams.get("ref");

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [consentProvider, setConsentProvider] = useState<"github" | "google" | null>(null);

  // Redirect already-authenticated users to dashboard
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        window.location.href = "/dashboard";
      }
    });
  }, []);

  // Store referral code in localStorage so it persists through the auth flow
  useEffect(() => {
    if (ref) {
      localStorage.setItem("referral_code", ref);
    }
  }, [ref]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const trimmedUsername = username.trim().toLowerCase();
    if (trimmedUsername.length < 3) {
      setError("Username must be at least 3 characters");
      setLoading(false);
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmedUsername)) {
      setError("Username can only contain letters, numbers, hyphens, and underscores");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username: trimmedUsername },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
    }
  };

  const handleGitHubSignUp = async () => {
    const supabase = createClient();
    // Public-only OAuth (Supabase default scope). We deliberately do NOT
    // request the `repo` scope: GitHub OAuth Apps can't grant read-only
    // private access — `repo` is read+write+admin, which is more than we
    // need (we only ever read repo metadata) and scares users off. Read-only
    // private-repo support is coming via a GitHub App with fine-grained
    // permissions instead.
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  const handleGoogleSignUp = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  if (success) {
    return (
      <div className="mx-auto max-w-md px-4 sm:px-6 py-24 text-center">
        <CheckCircle weight="fill" size={56} className="mx-auto mb-5" style={{ color: "#16A34A" }} />
        <h2 className="text-2xl font-bold text-[var(--foreground)]">Check your email</h2>
        <p className="mt-3 text-sm text-[var(--text-secondary)] font-medium leading-relaxed">
          We sent a confirmation link to <strong className="text-[var(--foreground)]">{email}</strong>. Click it to
          activate your account and start building your vibe coding profile.
        </p>
      </div>
    );
  }

  return (
    <AuthShell>
      <AuthHeader title="Join VibeTalent" subtitle="Create your account and start shipping">
        {ref && (
          <div
            className="mt-4 inline-flex px-4 py-1.5 text-sm font-semibold rounded-full"
            style={{
              backgroundColor: "var(--status-success-bg)",
              color: "var(--status-success-text)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            Referred by @{ref}
          </div>
        )}
      </AuthHeader>

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

      <form onSubmit={handleSignUp} className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-[var(--text-muted)] mb-1.5 block">
            Username
          </label>
          <div className="relative">
            <User weight="fill" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(normalizeUsernameInput(e.target.value))}
              placeholder="your_username"
              className="input-brutal" style={{ paddingLeft: "2.5rem" }}
              required
            />
          </div>
        </div>

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
          <label className="text-xs font-semibold text-[var(--text-muted)] mb-1.5 block">
            Password
          </label>
          <div className="relative">
            <Lock weight="fill" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 6 characters"
              className="input-brutal" style={{ paddingLeft: "2.5rem" }}
              minLength={6}
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
          {loading ? "Creating account..." : "Create Account"}
        </AuthPrimaryButton>
      </form>

      <p className="mt-8 text-center text-sm font-medium text-[var(--text-secondary)]">
        Already have an account?{" "}
        <Link href="/auth/login" className="font-semibold text-[var(--accent)] hover:underline">
          Sign In
        </Link>
      </p>

      {consentProvider && (
        <OAuthConsentModal
          provider={consentProvider}
          onConfirm={() => {
            if (consentProvider === "github") handleGitHubSignUp();
            else handleGoogleSignUp();
            setConsentProvider(null);
          }}
          onCancel={() => setConsentProvider(null)}
        />
      )}
    </AuthShell>
  );
}
