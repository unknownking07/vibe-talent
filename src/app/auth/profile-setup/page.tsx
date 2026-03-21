"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
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
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [streakLogged, setStreakLogged] = useState(false);

  // Step 1
  const [profile, setProfile] = useState<ProfileData>({
    username: "",
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
    };
    checkAuth();
  }, [router]);

  /* ── Helpers ─────────────────────────────────────────────── */

  const supabase = createClient();

  const validateUsername = (value: string) => {
    if (value.length < 3) return "Username must be at least 3 characters";
    if (!/^[a-z_]+$/.test(value))
      return "Only lowercase letters and underscores allowed";
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
          bio: profile.bio || null,
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

  const handleStep2Next = async () => {
    setError("");
    setLoading(true);

    try {
      const hasLinks =
        socials.github || socials.twitter || socials.website || socials.telegram;

      if (hasLinks) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: dbError } = await (
          supabase.from("social_links") as any
        ).upsert(
          {
            user_id: userId,
            github: socials.github || null,
            twitter: socials.twitter || null,
            website: socials.website || null,
            telegram: socials.telegram || null,
          },
          { onConflict: "user_id" }
        );

        if (dbError) throw dbError;
      }

      setStep(3);
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
      const { error: dbError } = await (
        supabase.from("projects") as any
      ).insert({
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
      const { error: dbError } = await (
        supabase.from("streak_logs") as any
      ).upsert(
        {
          user_id: userId,
          log_date: today,
        },
        { onConflict: "user_id,log_date" }
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

  const ProgressBar = () => (
    <div className="flex items-center justify-center gap-2 mb-8">
      {[1, 2, 3, 4].map((s) => (
        <div key={s} className="flex items-center gap-2">
          <div className="flex flex-col items-center gap-1">
            <div
              className="w-8 h-8 flex items-center justify-center text-xs font-extrabold border-2 border-[#0F0F0F]"
              style={{
                backgroundColor:
                  s < step ? "#0F0F0F" : s === step ? "#FF3A00" : "#FFFFFF",
                color: s <= step ? "#FFFFFF" : "#0F0F0F",
              }}
            >
              {s < step ? "✓" : s}
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wide text-[#52525B]">
              {STEP_LABELS[s - 1]}
            </span>
          </div>
          {s < 4 && (
            <div
              className="w-8 h-0.5 mb-4"
              style={{
                backgroundColor: s < step ? "#0F0F0F" : "#E5E5E5",
              }}
            />
          )}
        </div>
      ))}
    </div>
  );

  /* ── Error display ───────────────────────────────────────── */

  const ErrorBox = () =>
    error ? (
      <div
        className="p-3 text-sm font-bold text-[#991B1B]"
        style={{
          backgroundColor: "#FEF2F2",
          border: "2px solid #0F0F0F",
        }}
      >
        {error}
      </div>
    ) : null;

  /* ── Step 1: Profile Basics ──────────────────────────────── */

  const Step1 = () => (
    <div className="space-y-5">
      <div className="flex items-center gap-3 mb-2">
        <div
          className="w-10 h-10 flex items-center justify-center"
          style={{
            backgroundColor: "#FF3A00",
            border: "2px solid #0F0F0F",
          }}
        >
          <Zap size={20} className="text-white" />
        </div>
        <div>
          <h2 className="text-xl font-extrabold uppercase text-[#0F0F0F]">
            Profile Basics
          </h2>
          <p className="text-xs text-[#52525B] font-medium">
            Tell us who you are
          </p>
        </div>
      </div>

      <div>
        <label className="text-xs font-bold uppercase tracking-wide text-[#52525B] mb-1.5 block">
          Username *
        </label>
        <input
          type="text"
          value={profile.username}
          onChange={(e) =>
            setProfile({
              ...profile,
              username: e.target.value.toLowerCase().replace(/[^a-z_]/g, ""),
            })
          }
          placeholder="your_username"
          className="input-brutal w-full"
          required
        />
        <p className="text-[10px] text-[#52525B] mt-1">
          Min 3 chars. Lowercase letters and underscores only.
        </p>
      </div>

      <div>
        <label className="text-xs font-bold uppercase tracking-wide text-[#52525B] mb-1.5 block">
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

      <ErrorBox />

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

  const Step2 = () => (
    <div className="space-y-5">
      <div className="flex items-center gap-3 mb-2">
        <div
          className="w-10 h-10 flex items-center justify-center"
          style={{
            backgroundColor: "#FF3A00",
            border: "2px solid #0F0F0F",
          }}
        >
          <LinkIcon size={20} className="text-white" />
        </div>
        <div>
          <h2 className="text-xl font-extrabold uppercase text-[#0F0F0F]">
            Social Links
          </h2>
          <p className="text-xs text-[#52525B] font-medium">
            Connect your profiles (all optional)
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Github size={18} className="text-[#52525B] shrink-0" />
        <input
          type="text"
          value={socials.github}
          onChange={(e) => setSocials({ ...socials, github: e.target.value })}
          placeholder="GitHub username"
          className="input-brutal w-full"
        />
      </div>

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
        <Globe size={18} className="text-[#52525B] shrink-0" />
        <input
          type="text"
          value={socials.website}
          onChange={(e) => setSocials({ ...socials, website: e.target.value })}
          placeholder="https://your-website.com"
          className="input-brutal w-full"
        />
      </div>

      <div className="flex items-center gap-3">
        <TelegramIcon size={18} className="text-[#52525B] shrink-0" />
        <input
          type="text"
          value={socials.telegram}
          onChange={(e) => setSocials({ ...socials, telegram: e.target.value })}
          placeholder="Telegram username"
          className="input-brutal w-full"
        />
      </div>

      <ErrorBox />

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

      <button
        type="button"
        onClick={() => {
          setError("");
          setStep(3);
        }}
        className="w-full text-center text-xs font-bold uppercase tracking-wide text-[#52525B] hover:text-[#FF3A00] transition-colors"
      >
        Skip this step
      </button>
    </div>
  );

  /* ── Step 3: First Project ───────────────────────────────── */

  const Step3 = () => (
    <div className="space-y-5">
      <div className="flex items-center gap-3 mb-2">
        <div
          className="w-10 h-10 flex items-center justify-center"
          style={{
            backgroundColor: "#FF3A00",
            border: "2px solid #0F0F0F",
          }}
        >
          <FolderGit2 size={20} className="text-white" />
        </div>
        <div>
          <h2 className="text-xl font-extrabold uppercase text-[#0F0F0F]">
            First Project
          </h2>
          <p className="text-xs text-[#52525B] font-medium">
            Showcase what you&apos;re building (optional)
          </p>
        </div>
      </div>

      <div>
        <label className="text-xs font-bold uppercase tracking-wide text-[#52525B] mb-1.5 block">
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
        <label className="text-xs font-bold uppercase tracking-wide text-[#52525B] mb-1.5 block">
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
        <label className="text-xs font-bold uppercase tracking-wide text-[#52525B] mb-1.5 block">
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
        <p className="text-[10px] text-[#52525B] mt-1">Comma-separated</p>
      </div>

      <div>
        <label className="text-xs font-bold uppercase tracking-wide text-[#52525B] mb-1.5 block">
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

      <ErrorBox />

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
        className="w-full text-center text-xs font-bold uppercase tracking-wide text-[#52525B] hover:text-[#FF3A00] transition-colors"
      >
        Skip this step
      </button>
    </div>
  );

  /* ── Step 4: First Streak ────────────────────────────────── */

  const Step4 = () => (
    <div className="space-y-6 text-center">
      <div className="flex items-center justify-center gap-3 mb-2">
        <div
          className="w-10 h-10 flex items-center justify-center"
          style={{
            backgroundColor: "#FF3A00",
            border: "2px solid #0F0F0F",
          }}
        >
          <Flame size={20} className="text-white" />
        </div>
        <div className="text-left">
          <h2 className="text-xl font-extrabold uppercase text-[#0F0F0F]">
            Start Your Streak
          </h2>
          <p className="text-xs text-[#52525B] font-medium">
            Build every day. Ship every day.
          </p>
        </div>
      </div>

      {!streakLogged ? (
        <>
          <div
            className="p-8"
            style={{
              backgroundColor: "#FFFBF5",
              border: "2px solid #0F0F0F",
            }}
          >
            <Flame
              size={48}
              className="mx-auto mb-4"
              style={{ color: "#FF3A00" }}
            />
            <p className="text-sm font-bold text-[#0F0F0F] uppercase mb-1">
              Day 1 starts now
            </p>
            <p className="text-xs text-[#52525B]">
              Log your first day and begin your building streak
            </p>
          </div>

          <ErrorBox />

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
              backgroundColor: "#F0FFF4",
              border: "2px solid #0F0F0F",
              boxShadow: "var(--shadow-brutal)",
            }}
          >
            <div className="flex items-center justify-center gap-2 mb-4">
              <PartyPopper
                size={32}
                className="animate-bounce"
                style={{ color: "#FF3A00" }}
              />
              <span className="text-4xl font-extrabold text-[#0F0F0F]">
                1
              </span>
              <Flame
                size={32}
                className="animate-pulse"
                style={{ color: "#FF3A00" }}
              />
            </div>
            <p className="text-lg font-extrabold uppercase text-[#0F0F0F]">
              Streak Started!
            </p>
            <p className="text-sm text-[#52525B] mt-1">
              You&apos;re officially a builder. Keep it going!
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/dashboard")}
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
            border: "2px solid #0F0F0F",
            boxShadow: "var(--shadow-brutal)",
          }}
        >
          <Flame size={28} className="text-white" />
        </div>
        <h1 className="text-3xl font-extrabold uppercase text-[#0F0F0F]">
          Set Up Profile
        </h1>
        <p className="mt-2 text-sm text-[#52525B] font-medium">
          Complete your VibeTalent builder profile
        </p>
      </div>

      {/* Progress */}
      <ProgressBar />

      {/* Card */}
      <div
        className="p-6"
        style={{
          backgroundColor: "#FFFFFF",
          border: "2px solid #0F0F0F",
          boxShadow: "var(--shadow-brutal)",
        }}
      >
        {step === 1 && <Step1 />}
        {step === 2 && <Step2 />}
        {step === 3 && <Step3 />}
        {step === 4 && <Step4 />}
      </div>
    </div>
  );
}
