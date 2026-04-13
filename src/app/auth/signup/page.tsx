"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Github, Mail, Lock, User, Check } from "lucide-react";
import Image from "next/image";
import OAuthConsentModal from "@/components/auth/oauth-consent-modal";

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
      <div className="mx-auto max-w-md px-4 sm:px-6 py-20">
        <div
          className="p-8 text-center"
          style={{
            backgroundColor: "var(--status-success-bg)",
            border: "2px solid var(--border-hard)",
            boxShadow: "var(--shadow-brutal)",
          }}
        >
          <div
            className="w-16 h-16 mx-auto mb-4 flex items-center justify-center"
            style={{ backgroundColor: "#16A34A", border: "2px solid var(--border-hard)" }}
          >
            <Check size={28} className="text-white" />
          </div>
          <h2 className="text-2xl font-extrabold uppercase text-[var(--status-success-text)]">Check Your Email</h2>
          <p className="mt-3 text-sm text-[var(--status-success-text)] font-medium">
            We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account and start building your vibe coding profile.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 sm:px-6 py-20">
      <div className="text-center mb-8">
        <Image src="/logo.png" alt="VibeTalent" width={56} height={56} className="mx-auto mb-4 object-contain" />
        <h1 className="text-3xl font-extrabold uppercase text-[var(--foreground)]">Join VibeTalent</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)] font-medium">
          Create your account and start shipping
        </p>
        {ref && (
          <div
            className="mt-3 inline-block px-4 py-2 text-sm font-bold text-[#065F46]"
            style={{
              backgroundColor: "#D1FAE5",
              border: "2px solid var(--border-hard)",
            }}
          >
            Referred by @{ref}
          </div>
        )}
      </div>

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

        <form onSubmit={handleSignUp} className="space-y-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-1.5 block">
              Username
            </label>
            <div className="relative">
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                placeholder="your_username"
                className="input-brutal" style={{ paddingLeft: "2.5rem" }}
                required
              />
            </div>
          </div>

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
            <label className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-1.5 block">
              Password
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
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
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-sm font-medium text-[var(--text-secondary)]">
        Already have an account?{" "}
        <Link href="/auth/login" className="font-bold text-[var(--accent)] hover:underline uppercase">
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
    </div>
  );
}
