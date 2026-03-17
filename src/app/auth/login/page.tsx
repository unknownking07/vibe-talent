"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Flame, Github, Mail, Lock } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

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
      router.push("/dashboard");
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
            border: "2px solid #0F0F0F",
            boxShadow: "var(--shadow-brutal-sm)",
          }}
        >
          <Flame size={28} className="text-white" />
        </div>
        <h1 className="text-3xl font-extrabold uppercase text-[#0F0F0F]">Welcome Back</h1>
        <p className="mt-2 text-sm text-[#52525B] font-medium">
          Sign in to your VibeTalent account
        </p>
      </div>

      <div
        className="p-6 space-y-5"
        style={{
          backgroundColor: "#FFFFFF",
          border: "2px solid #0F0F0F",
          boxShadow: "var(--shadow-brutal)",
        }}
      >
        <div className="space-y-3">
          <button
            onClick={handleGitHubLogin}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 text-sm font-extrabold uppercase tracking-wide text-white cursor-pointer transition-colors hover:bg-[#2a2a2a]"
            style={{
              backgroundColor: "#0F0F0F",
              border: "2px solid #0F0F0F",
            }}
          >
            <Github size={18} />
            Continue with GitHub
          </button>

          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 text-sm font-extrabold uppercase tracking-wide text-[#0F0F0F] cursor-pointer transition-colors hover:bg-[#F5F5F5]"
            style={{
              backgroundColor: "#FFFFFF",
              border: "2px solid #0F0F0F",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Continue with Google
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-[2px] bg-[#0F0F0F]" />
          <span className="text-xs font-bold uppercase text-[#71717A]">Or</span>
          <div className="flex-1 h-[2px] bg-[#0F0F0F]" />
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-[#71717A] mb-1.5 block">
              Email
            </label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#71717A]" />
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
            <label className="text-xs font-bold uppercase tracking-wide text-[#71717A] mb-1.5 block">
              Password
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#71717A]" />
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
              className="p-3 text-sm font-bold text-[#991B1B]"
              style={{
                backgroundColor: "#FEF2F2",
                border: "2px solid #0F0F0F",
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
              border: "2px solid #0F0F0F",
            }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-sm font-medium text-[#52525B]">
        Don&apos;t have an account?{" "}
        <Link href="/auth/signup" className="font-bold text-[var(--accent)] hover:underline uppercase">
          Sign Up
        </Link>
      </p>
    </div>
  );
}
