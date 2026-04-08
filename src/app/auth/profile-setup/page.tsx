"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Flame,
  Github,
  Globe,
  Send as TelegramIcon,
  ArrowRight,
  ArrowLeft,
  Zap,
  Link as LinkIcon,
  FolderGit2,
  PartyPopper,
} from "lucide-react";

/* ── Types ───────────────────────────────────────────────────── */

interface ProfileData {
  username: string;
  display_name: string;
  bio: string;
}

interface SocialData {
  github: string;
  twitter: string;
  website: string;
  telegram: string;
}

interface ProjectData {
  title: string;
  description: string;
  tech_stack: string;
  github_url: string;
}

/* ── Constants ───────────────────────────────────────────────── */

const STEP_LABELS = ["Profile", "Links", "Project", "Go!"] as const;

/* ── Component ───────────────────────────────────────────────── */

export default function ProfileSetupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialStep = Number(searchParams.get("step")) || 1;
  const [step, setStep] = useState(initialStep);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [oauthAvatarUrl, setOauthAvatarUrl] = useState<string | null>(null);
  const [verifiedGithub, setVerifiedGithub] = useState<string | null>(null);
  const [connectingGithub, setConnectingGithub] = useState(false);
  const [streakLogged, setStreakLogged] = useState(false);

  // Step 1
  const [profile, setProfile] = useState<ProfileData>({
    username: "",
    display_name: "",
    bio: "",
  });

  // Step 2
  const [socials, setSocials] = useState<SocialData>({
    github: "",
    twitter: "",
    website: "",
    telegram: "",
  });

  // Step 3
  const [project, setProject] = useState<ProjectData>({
    title: "",
    description: "",
    tech_stack: "",
    github_url: "",
  });

  /* ── Auth check ──────────────────────────────────────────── */

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth/login");
        return;
      }
      setUserId(user.id);
      // Grab OAuth avatar from provider metadata
      const avatar =
        user.user_metadata?.avatar_url ||
        user.user_metadata?.picture ||
        null;
      setOauthAvatarUrl(avatar);

      // Pre-fill display_name from OAuth metadata if available.
      const oauthFullName =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        "";
      if (oauthFullName) {
        setProfile((p) => (p.display_name ? p : { ...p, display_name: oauthFullName }));
      }

      // Check if GitHub ownership has already been verified (via OAuth signup
      // or a prior linkIdentity flow). This is the only trusted source.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: userRow } = await (supabase.from("users") as any)
        .select("display_name, github_username")
        .eq("id", user.id)
        .single();
      if (userRow?.display_name) {
        setProfile((p) => ({ ...p, display_name: userRow.display_name }));
      }
      if (userRow?.github_username) {
        setVerifiedGithub(userRow.github_username);
        setSocials((s) => ({ ...s, github: userRow.github_username }));
      }

      // If returning user redirected to step 2, pre-fill existing socials
      if (initialStep === 2) {
        const supabase = createClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabase.from("social_links") as any)
          .select("*")
          .eq("user_id", user.id)
          .single();
        if (data) {
          setSocials({
            github: data.github || "",
            twitter: data.twitter || "",
            website: data.website || "",
            telegram: data.telegram || "",
          });
        }
      }
    };
    checkAuth();
  }, [router, initialStep]);

  /* ── Helpers ─────────────────────────────────────────────── */

  const supabase = createClient();

  const validateUsername = (value: string) => {
    if (value.length < 3) return "Username must be at least 3 characters";
    if (!/^[a-z0-9_]+$/.test(value))
      return "Only lowercase letters, numbers, and underscores allowed";
    return null;
  };

  /* ── Step handlers ───────────────────────────────────────── */

  const handleStep1Next = async () => {
    const usernameError = validateUsername(profile.username);
    if (usernameError) {
      setError(usernameError);
      return;
    }

    setError("");
    setLoading(true);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: dbError } = await (supabase.from("users") as any).upsert(
        {
          id: userId,
          username: profile.username,
          display_name: profile.display_name.trim() || null,
          bio: profile.bio || null,
          ...(oauthAvatarUrl ? { avatar_url: oauthAvatarUrl } : {}),
        },
        { onConflict: "id" }
      );

      if (dbError) throw dbError;
      setStep(2);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to save profile";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectGithub = async () => {
    setConnectingGithub(true);
    setError("");
    const { error: linkError } = await supabase.auth.linkIdentity({
      provider: "github",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/profile-setup?step=2`,
      },
    });
    if (linkError) {
      setError(`Couldn't connect GitHub: ${linkError.message}`);
      setConnectingGithub(false);
    }
    // Success → browser redirects to GitHub OAuth.
  };

  const handleStep2Next = async () => {
    const twitter = socials.twitter.trim();
    const telegram = socials.telegram.trim();
    if (!verifiedGithub) {
      setError("Connect your GitHub account to verify ownership before continuing.");
      return;
    }
    if (!twitter && !telegram) {
      setError("Please add your X (Twitter) or Telegram so clients can contact you.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      // Always use the verified handle, never a free-text value.
      const github = verifiedGithub;
      const website = socials.website.trim();
      const hasLinks = github || twitter || website || telegram;

      if (hasLinks) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: dbError } = await (supabase.from("social_links") as any).upsert(
          {
            user_id: userId,
            github: github || null,
            twitter: twitter || null,
            website: website || null,
            telegram: telegram || null,
          },
          { onConflict: "user_id" }
        );

        if (dbError) throw dbError;
      }

      // If returning user (came from dashboard redirect), skip to streak step
      if (initialStep === 2) {
        setStep(4);
      } else {
        setStep(3);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to save links";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleStep3Add = async () => {
    if (!project.title || !project.description) {
      setError("Title and description are required");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const techArray = project.tech_stack
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: dbError } = await (supabase.from("projects") as any).insert({
        user_id: userId,
        title: project.title,
        description: project.description,
        tech_stack: techArray.length > 0 ? techArray : null,
        github_url: project.github_url || null,
      });

      if (dbError) throw dbError;
      setStep(4);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to save project";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogStreak = async () => {
    setError("");
    setLoading(true);

    try {
      const today = new Date().toISOString().split("T")[0];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: dbError } = await (supabase.from("streak_logs") as any).upsert(
        {
          user_id: userId,
          activity_date: today,
        },
        { onConflict: "user_id,activity_date" }
      );

      if (dbError) throw dbError;
      setStreakLogged(true);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to log streak";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  /* ── Progress bar ────────────────────────────────────────── */

  const progressBar = (
    <div className="flex items-center justify-center gap-2 mb-8">
      {[1, 2, 3, 4].map((s) => (
        <div key={s} className="flex items-center gap-2">
          <div className="flex flex-col items-center gap-1">
            <div
              className="w-8 h-8 flex items-center justify-center text-xs font-extrabold border-2 border-[var(--border-hard)]"
              style={{
                backgroundColor:
                  s < step ? "var(--foreground)" : s === step ? "#FF3A00" : "var(--bg-surface)",
                color: s <= step ? "var(--background)" : "var(--foreground)",
              }}
            >
              {s < step ? "✓" : s}
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">
              {STEP_LABELS[s - 1]}
            </span>
          </div>
          {s < 4 && (
            <div
              className="w-8 h-0.5 mb-4"
              style={{
                backgroundColor: s < step ? "var(--bg-inverted)" : "var(--border-subtle)",
              }}
            />
          )}
        </div>
      ))}
    </div>
  );

  /* ── Error display ───────────────────────────────────────── */

  const errorBox = error ? (
    <div
      className="p-3 text-sm font-bold text-[var(--status-error-text)]"
      style={{
        backgroundColor: "var(--status-error-bg)",
        border: "2px solid var(--border-hard)",
      }}
    >
      {error}
    </div>
  ) : null;

  /* ── Step 1: Profile Basics ──────────────────────────────── */

  const step1Content = (
    <div className="space-y-5">
      <div className="flex items-center gap-3 mb-2">
        <div
          className="w-10 h-10 flex items-center justify-center"
          style={{
            backgroundColor: "#FF3A00",
            border: "2px solid var(--border-hard)",
          }}
        >
          <Zap size={20} className="text-white" />
        </div>
        <div>
          <h2 className="text-xl font-extrabold uppercase text-[var(--foreground)]">
            Profile Basics
          </h2>
          <p className="text-xs text-[var(--text-secondary)] font-medium">
            Tell us who you are
          </p>
        </div>
      </div>

      <div>
        <label className="text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)] mb-1.5 block">
          Username *
        </label>
        <input
          type="text"
          value={profile.username}
          onChange={(e) =>
            setProfile({
              ...profile,
              username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""),
            })
          }
          placeholder="your_username"
          className="input-brutal w-full"
          required
        />
        <p className="text-[10px] text-[var(--text-secondary)] mt-1">
          Min 3 chars. Lowercase letters, numbers, and underscores only.
        </p>
      </div>

      <div>
        <label className="text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)] mb-1.5 block">
          Display Name
        </label>
        <input
          type="text"
          value={profile.display_name}
          onChange={(e) => setProfile({ ...profile, display_name: e.target.value })}
          placeholder="Your full name (e.g. Abhinav Kumar)"
          maxLength={50}
          className="input-brutal w-full"
        />
        <p className="text-[10px] text-[var(--text-secondary)] mt-1">
          Shown above your @username on your profile. Optional but recommended.
        </p>
      </div>

      <div>
        <label className="text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)] mb-1.5 block">
          Bio
        </label>
        <textarea
          value={profile.bio}
          onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
          placeholder="Tell the world what you build..."
          rows={3}
          className="input-brutal w-full resize-none"
        />
      </div>

      {errorBox}

      <button
        type="button"
        onClick={handleStep1Next}
        disabled={loading}
        className="btn-brutal btn-brutal-primary w-full justify-center text-sm"
      >
        {loading ? "Saving..." : "Next"}
        {!loading && <ArrowRight size={16} className="ml-2" />}
      </button>
    </div>
  );

  /* ── Step 2: Social Links ────────────────────────────────── */

  const step2Content = (
    <div className="space-y-5">
      <div className="flex items-center gap-3 mb-2">
        <div
          className="w-10 h-10 flex items-center justify-center"
          style={{
            backgroundColor: "#FF3A00",
            border: "2px solid var(--border-hard)",
          }}
        >
          <LinkIcon size={20} className="text-white" />
        </div>
        <div>
          <h2 className="text-xl font-extrabold uppercase text-[var(--foreground)]">
            Social Links
          </h2>
          <p className="text-xs text-[var(--text-secondary)] font-medium">
            GitHub required + X or Telegram so clients can reach you
          </p>
        </div>
      </div>

      {verifiedGithub ? (
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{
            backgroundColor: "var(--status-success-bg)",
            border: "2px solid var(--border-hard)",
          }}
        >
          <Github size={18} className="text-[var(--status-success-text)] shrink-0" />
          <span className="font-bold text-[var(--status-success-text)]">@{verifiedGithub}</span>
          <span className="text-xs font-bold uppercase text-[var(--status-success-text)] opacity-70 ml-auto">
            Verified ✓
          </span>
        </div>
      ) : (
        <div>
          <button
            type="button"
            onClick={handleConnectGithub}
            disabled={connectingGithub}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 text-sm font-extrabold uppercase tracking-wide text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:bg-[var(--bg-pill-hover)]"
            style={{
              backgroundColor: "var(--bg-inverted)",
              border: "2px solid var(--border-hard)",
            }}
          >
            <Github size={18} />
            {connectingGithub ? "Connecting..." : "Connect GitHub to verify *"}
          </button>
          <p className="mt-1.5 text-xs font-medium text-[var(--text-muted)]">
            We verify ownership via GitHub OAuth so employers can trust your contributions.
          </p>
        </div>
      )}

      <div className="flex items-center gap-3">
        <svg
          width={18}
          height={18}
          viewBox="0 0 24 24"
          fill="#52525B"
          className="shrink-0"
        >
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
        <input
          type="text"
          value={socials.twitter}
          onChange={(e) => setSocials({ ...socials, twitter: e.target.value })}
          placeholder="X / Twitter handle"
          className="input-brutal w-full"
        />
      </div>

      <div className="flex items-center gap-3">
        <Globe size={18} className="text-[var(--text-secondary)] shrink-0" />
        <input
          type="text"
          value={socials.website}
          onChange={(e) => setSocials({ ...socials, website: e.target.value })}
          placeholder="https://your-website.com"
          className="input-brutal w-full"
        />
      </div>

      <div className="flex items-center gap-3">
        <TelegramIcon size={18} className="text-[var(--text-secondary)] shrink-0" />
        <input
          type="text"
          value={socials.telegram}
          onChange={(e) => setSocials({ ...socials, telegram: e.target.value })}
          placeholder="Telegram username"
          className="input-brutal w-full"
        />
      </div>

      {errorBox}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            setError("");
            setStep(1);
          }}
          className="btn-brutal w-full justify-center text-sm"
        >
          <ArrowLeft size={16} className="mr-2" />
          Back
        </button>
        <button
          type="button"
          onClick={handleStep2Next}
          disabled={loading}
          className="btn-brutal btn-brutal-primary w-full justify-center text-sm"
        >
          {loading ? "Saving..." : "Next"}
          {!loading && <ArrowRight size={16} className="ml-2" />}
        </button>
      </div>

    </div>
  );

  /* ── Step 3: First Project ───────────────────────────────── */

  const step3Content = (
    <div className="space-y-5">
      <div className="flex items-center gap-3 mb-2">
        <div
          className="w-10 h-10 flex items-center justify-center"
          style={{
            backgroundColor: "#FF3A00",
            border: "2px solid var(--border-hard)",
          }}
        >
          <FolderGit2 size={20} className="text-white" />
        </div>
        <div>
          <h2 className="text-xl font-extrabold uppercase text-[var(--foreground)]">
            First Project
          </h2>
          <p className="text-xs text-[var(--text-secondary)] font-medium">
            Showcase what you&apos;re building (optional)
          </p>
        </div>
      </div>

      <div>
        <label className="text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)] mb-1.5 block">
          Project Title *
        </label>
        <input
          type="text"
          value={project.title}
          onChange={(e) => setProject({ ...project, title: e.target.value })}
          placeholder="My Awesome App"
          className="input-brutal w-full"
        />
      </div>

      <div>
        <label className="text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)] mb-1.5 block">
          Description *
        </label>
        <textarea
          value={project.description}
          onChange={(e) =>
            setProject({ ...project, description: e.target.value })
          }
          placeholder="What does it do?"
          rows={3}
          className="input-brutal w-full resize-none"
        />
      </div>

      <div>
        <label className="text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)] mb-1.5 block">
          Tech Stack
        </label>
        <input
          type="text"
          value={project.tech_stack}
          onChange={(e) =>
            setProject({ ...project, tech_stack: e.target.value })
          }
          placeholder="React, Node.js, Supabase"
          className="input-brutal w-full"
        />
        <p className="text-[10px] text-[var(--text-secondary)] mt-1">Comma-separated</p>
      </div>

      <div>
        <label className="text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)] mb-1.5 block">
          GitHub URL
        </label>
        <input
          type="text"
          value={project.github_url}
          onChange={(e) =>
            setProject({ ...project, github_url: e.target.value })
          }
          placeholder="https://github.com/you/project"
          className="input-brutal w-full"
        />
      </div>

      {errorBox}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            setError("");
            setStep(2);
          }}
          className="btn-brutal w-full justify-center text-sm"
        >
          <ArrowLeft size={16} className="mr-2" />
          Back
        </button>
        <button
          type="button"
          onClick={handleStep3Add}
          disabled={loading}
          className="btn-brutal btn-brutal-primary w-full justify-center text-sm"
        >
          {loading ? "Saving..." : "Add Project"}
          {!loading && <ArrowRight size={16} className="ml-2" />}
        </button>
      </div>

      <button
        type="button"
        onClick={() => {
          setError("");
          setStep(4);
        }}
        className="w-full text-center text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)] hover:text-[#FF3A00] transition-colors"
      >
        Skip this step
      </button>
    </div>
  );

  /* ── Step 4: First Streak ────────────────────────────────── */

  const step4Content = (
    <div className="space-y-6 text-center">
      <div className="flex items-center justify-center gap-3 mb-2">
        <div
          className="w-10 h-10 flex items-center justify-center"
          style={{
            backgroundColor: "#FF3A00",
            border: "2px solid var(--border-hard)",
          }}
        >
          <Flame size={20} className="text-white" />
        </div>
        <div className="text-left">
          <h2 className="text-xl font-extrabold uppercase text-[var(--foreground)]">
            Start Your Streak
          </h2>
          <p className="text-xs text-[var(--text-secondary)] font-medium">
            Build every day. Ship every day.
          </p>
        </div>
      </div>

      {!streakLogged ? (
        <>
          <div
            className="p-8"
            style={{
              backgroundColor: "var(--bg-surface-light)",
              border: "2px solid var(--border-hard)",
            }}
          >
            <Flame
              size={48}
              className="mx-auto mb-4"
              style={{ color: "#FF3A00" }}
            />
            <p className="text-sm font-bold text-[var(--foreground)] uppercase mb-1">
              Day 1 starts now
            </p>
            <p className="text-xs text-[var(--text-secondary)]">
              Log your first day and begin your building streak
            </p>
          </div>

          {errorBox}

          <button
            type="button"
            onClick={handleLogStreak}
            disabled={loading}
            className="btn-brutal btn-brutal-primary w-full justify-center text-sm"
            style={{ fontSize: "16px", padding: "14px 24px" }}
          >
            {loading ? "Logging..." : "Log Your First Day"}
            {!loading && <Flame size={18} className="ml-2" />}
          </button>
        </>
      ) : (
        <>
          <div
            className="p-8"
            style={{
              backgroundColor: "var(--status-success-bg)",
              border: "2px solid var(--border-hard)",
              boxShadow: "var(--shadow-brutal)",
            }}
          >
            <div className="flex items-center justify-center gap-2 mb-4">
              <PartyPopper
                size={32}
                className="animate-bounce"
                style={{ color: "#FF3A00" }}
              />
              <span className="text-4xl font-extrabold text-[var(--foreground)]">
                1
              </span>
              <Flame
                size={32}
                className="animate-pulse"
                style={{ color: "#FF3A00" }}
              />
            </div>
            <p className="text-lg font-extrabold uppercase text-[var(--foreground)]">
              Streak Started!
            </p>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              You&apos;re officially a builder. Keep it going!
            </p>
          </div>

          <button
            type="button"
            onClick={async () => {
              // Process referral if exists
              const refCode = localStorage.getItem("referral_code");
              if (refCode && refCode !== profile.username && userId) {
                try {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const sb = supabase as any;
                  // Find the referrer
                  const { data: referrer } = await sb
                    .from("users")
                    .select("id, referral_count")
                    .eq("username", refCode)
                    .single();
                  if (referrer) {
                    // Create referral record
                    await sb.from("referrals").insert({
                      referrer_id: referrer.id,
                      referred_id: userId,
                    });
                    // Give referrer a streak bonus day
                    const today = new Date().toISOString().split("T")[0];
                    await sb.from("streak_logs").upsert(
                      { user_id: referrer.id, activity_date: today },
                      { onConflict: "user_id,activity_date" }
                    );
                    // Increment referral count
                    await sb
                      .from("users")
                      .update({
                        referral_count: (referrer.referral_count || 0) + 1,
                      })
                      .eq("id", referrer.id);
                  }
                } catch {
                  // Silently ignore referral errors — don't block onboarding
                }
                localStorage.removeItem("referral_code");
              }
              router.push("/dashboard");
            }}
            className="btn-brutal btn-brutal-primary w-full justify-center text-sm"
            style={{ fontSize: "16px", padding: "14px 24px" }}
          >
            Complete Setup
            <ArrowRight size={18} className="ml-2" />
          </button>
        </>
      )}
    </div>
  );

  /* ── Render ──────────────────────────────────────────────── */

  return (
    <div className="mx-auto max-w-lg px-4 sm:px-6 py-16">
      {/* Header */}
      <div className="text-center mb-6">
        <div
          className="inline-flex items-center justify-center w-14 h-14 mb-4"
          style={{
            backgroundColor: "#FF3A00",
            border: "2px solid var(--border-hard)",
            boxShadow: "var(--shadow-brutal)",
          }}
        >
          <Flame size={28} className="text-white" />
        </div>
        <h1 className="text-3xl font-extrabold uppercase text-[var(--foreground)]">
          Set Up Profile
        </h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)] font-medium">
          Complete your VibeTalent builder profile
        </p>
      </div>

      {/* Progress */}
      {progressBar}

      {/* Card */}
      <div
        className="p-6"
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "2px solid var(--border-hard)",
          boxShadow: "var(--shadow-brutal)",
        }}
      >
        {step === 1 && step1Content}
        {step === 2 && step2Content}
        {step === 3 && step3Content}
        {step === 4 && step4Content}
      </div>
    </div>
  );
}
