"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { validateDisplayName, containsProfanity } from "@/lib/profanity";
import { normalizeSocialHandle } from "@/lib/social-handles";
import { normalizeExternalUrl, normalizeRepoUrl } from "@/lib/url-normalize";
import { armTourTrigger, TOUR_FLAG_ENABLED } from "@/lib/onboarding";
import { syncGithubMirrors } from "@/lib/github-identity";
import { submitPendingReferral } from "@/lib/referral-client";
import { trackFunnelEvent } from "@/lib/funnel-events";
import { getGithubReturnPath, isGithubRecovery } from "@/lib/onboarding-flow";
import {
  saveOnboardingProfile,
  type ProfileWriteClient,
} from "@/lib/onboarding-profile";
import {
  isUsernameTakenError,
  normalizeUsernameInput,
  suggestAvailableUsername,
  validateUsername,
  type UsernameLookupClient,
} from "@/lib/username";
import { useUsernameAvailability } from "@/lib/use-username-availability";
import { GithubRepoPicker } from "@/components/onboarding/github-repo-picker";
import {
  Flame,
  Github,
  Globe,
  Mail,
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
const STEP_VIEW_EVENTS = [
  "onboarding_profile_viewed",
  "onboarding_links_viewed",
  "onboarding_project_viewed",
  "onboarding_go_viewed",
] as const;

/* ── Component ───────────────────────────────────────────────── */

export default function ProfileSetupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialStep = Number(searchParams.get("step")) || 1;
  const isRecovery = isGithubRecovery(searchParams);
  const [step, setStep] = useState(initialStep);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [contactEmail, setContactEmail] = useState<string | null>(null);
  const [oauthAvatarUrl, setOauthAvatarUrl] = useState<string | null>(null);
  const [verifiedGithub, setVerifiedGithub] = useState<string | null>(null);
  // GitHub's stable numeric ID, captured from OAuth identity. Persisted on
  // the initial users row insert below so github-sync can use it to tell a
  // rename apart from a reclaim.
  const [verifiedGithubId, setVerifiedGithubId] = useState<number | null>(null);
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

  useEffect(() => {
    if (!userId || isRecovery || step < 1 || step > STEP_VIEW_EVENTS.length) return;
    trackFunnelEvent(STEP_VIEW_EVENTS[step - 1]);
  }, [step, userId, isRecovery]);

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
      setContactEmail(user.email ?? null);
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
        .select("username, display_name, github_username, github_id")
        .eq("id", user.id)
        .maybeSingle();
      if (userRow?.display_name) {
        setProfile((p) => ({ ...p, display_name: userRow.display_name }));
      }
      // Whichever handle we end up trusting, from either branch below — it's
      // the preferred seed for the username pre-fill.
      let resolvedGithub: string | null = userRow?.github_username ?? null;
      if (userRow?.github_username) {
        setVerifiedGithub(userRow.github_username);
        setSocials((s) => ({ ...s, github: userRow.github_username }));
        if (typeof userRow.github_id === "number") {
          setVerifiedGithubId(userRow.github_id);
        }
      }
      // Entered whenever a mirror is incomplete, which includes a stored handle
      // with no stable id — not only a missing handle. GitHub might be linked in
      // Supabase auth but not yet synced to the users table (linkIdentity
      // succeeded and the redirect back to /auth/callback did not), and a row
      // carrying a handle alone sends github-sync down its username path, which
      // resolves whoever owns that handle now. The live OAuth identity read here
      // is authoritative in a way that lookup is not. Runs after the branch
      // above so its state updates win when both have a value.
      if (!userRow?.github_username || userRow?.github_id == null) {
        const identity = await syncGithubMirrors(supabase, user.id, user, {
          githubUsername: userRow?.github_username,
          githubId: userRow?.github_id,
          socialGithub: null,
        });
        if (identity) {
          resolvedGithub = identity.username;
          setVerifiedGithub(identity.username);
          setSocials((s) => ({ ...s, github: identity.username }));
          if (identity.id !== null) setVerifiedGithubId(identity.id);
        }
      }

      // Pre-fill the username. It is the only required field on this step and
      // was the only one left blank, so every signup had to invent a handle
      // before they could go anywhere — and the `users` row isn't written
      // until step 1 succeeds, so anyone who hesitated here left no row at all
      // and became invisible to every lifecycle email (they all read `users`).
      // The GitHub handle is already trusted above; email local-part and
      // display name cover Google and email signups.
      if (userRow?.username) {
        setProfile((p) => (p.username ? p : { ...p, username: userRow.username }));
      } else {
        const suggestion = await suggestAvailableUsername(
          supabase as unknown as UsernameLookupClient,
          [resolvedGithub, user.email?.split("@")[0], oauthFullName]
        );
        // Guard against clobbering anything typed while the lookup was in
        // flight, same as the display_name pre-fill above.
        if (suggestion) {
          setProfile((p) => (p.username ? p : { ...p, username: suggestion }));
        }
      }

      // If returning user redirected to step 2, pre-fill existing socials
      if (initialStep === 2) {
        const supabase = createClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabase.from("social_links") as any)
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();
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

  // Live, debounced availability for the username field (shared with settings).
  const usernameAvailability = useUsernameAvailability(profile.username);

  /* ── Step handlers ───────────────────────────────────────── */

  const handleStep1Next = async () => {
    const usernameError = validateUsername(profile.username);
    if (usernameError) {
      setError(usernameError);
      return;
    }
    if (containsProfanity(profile.username)) {
      setError("Username contains inappropriate language");
      return;
    }
    const displayNameError = validateDisplayName(profile.display_name);
    if (displayNameError) {
      setError(displayNameError);
      return;
    }
    if (!userId) {
      setError("Your session isn't ready yet — refresh the page and try again.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      // Create-or-update the row WITHOUT a PostgREST upsert. An upsert lists the
      // conflict-target `id` in its DO UPDATE SET clause, which the post-2026-05-29
      // column-level UPDATE grant denies for existing rows (42501 "permission
      // denied for table users"). saveOnboardingProfile splits the write so `id`
      // never lands in a SET clause — see it for the full rationale.
      //
      // github_username/github_id are written here because this is the first
      // write for GitHub-first OAuth signups — users.username is NOT NULL, so no
      // row exists when /auth/callback runs and its UPDATE silently no-ops.
      await saveOnboardingProfile(
        supabase as unknown as ProfileWriteClient,
        userId,
        {
          username: profile.username,
          display_name: profile.display_name.trim() || null,
          bio: profile.bio || null,
          ...(oauthAvatarUrl ? { avatar_url: oauthAvatarUrl } : {}),
          ...(verifiedGithub ? { github_username: verifiedGithub } : {}),
          ...(verifiedGithubId !== null ? { github_id: verifiedGithubId } : {}),
        }
      );

      // Ensure baseline vibe score is set for new users (non-fatal). The API
      // binds the recalculation to this user's verified session.
      try {
        await fetch("/api/streak/recalculate", { method: "POST" });
      } catch {
        // Don't block onboarding if recalculation fails
      }
      trackFunnelEvent("onboarding_profile_completed");
      setStep(2);
    } catch (err: unknown) {
      if (isUsernameTakenError(err)) {
        setError(`@${profile.username} is already taken — please choose another.`);
      } else {
        setError(err instanceof Error ? err.message : "Failed to save profile");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConnectGithub = async () => {
    setConnectingGithub(true);
    setError("");
    // Encode the destination so the inner "?step=2" survives. Without
    // encoding, the second "?" gets parsed as a separate query param on
    // /auth/callback and dropped, sending the user back to step 1.
    const nextPath = encodeURIComponent(getGithubReturnPath(isRecovery));
    const { error: linkError } = await supabase.auth.linkIdentity({
      provider: "github",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${nextPath}`,
      },
    });
    if (linkError) {
      setError(`Couldn't connect GitHub: ${linkError.message}`);
      setConnectingGithub(false);
    }
    // Success → browser redirects to GitHub OAuth.
  };

  const handleStep2Next = async () => {
    if (!verifiedGithub) {
      setError("Connect your GitHub account to verify ownership before continuing.");
      return;
    }
    const twitterResult = normalizeSocialHandle(socials.twitter, "twitter");
    if (!twitterResult.ok) {
      setError(twitterResult.error);
      return;
    }
    const telegramResult = normalizeSocialHandle(socials.telegram, "telegram");
    if (!telegramResult.ok) {
      setError(telegramResult.error);
      return;
    }
    const twitter = twitterResult.handle;
    const telegram = telegramResult.handle;
    // Deliberately NOT required. This gate used to block anyone without an X
    // or Telegram handle, on the reasoning that clients need a way to reach
    // you — but /api/hire notifies a builder by email and an in-app
    // notification and never reads either handle, so it was defending a path
    // that does not use it. It was holding 17 GitHub-verified builders out of
    // their own dashboard, 3 of whom had already shipped a project, against a
    // hire flow with 3 requests ever. GitHub stays mandatory: that one is the
    // verification the whole profile rests on.
    // Reflect cleaned values back so the user sees the bare handle if they
    // pasted a profile URL.
    setSocials((s) => ({ ...s, twitter, telegram }));

    setError("");
    setLoading(true);

    try {
      // Always use the verified handle, never a free-text value.
      const github = verifiedGithub;
      const website = socials.website.trim();
      const hasLinks = github || twitter || website || telegram;

      if (hasLinks) {
        // Normalize the website URL so the DB stores a canonical https:// form.
        let normalizedWebsite: string | null = null;
        if (website) {
          normalizedWebsite = normalizeExternalUrl(website);
          if (!normalizedWebsite) {
            setError("Website must be a valid URL (e.g. https://example.com)");
            setLoading(false);
            return;
          }
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: dbError } = await (supabase.from("social_links") as any).upsert(
          {
            user_id: userId,
            github: github || null,
            twitter: twitter || null,
            website: normalizedWebsite,
            telegram: telegram || null,
          },
          { onConflict: "user_id" }
        );

        if (dbError) throw dbError;
      }

      // Dashboard recovery skips the optional project step. A new user who
      // linked GitHub also returns to step 2, but should still see Projects.
      if (!isRecovery) trackFunnelEvent("onboarding_links_completed");
      if (isRecovery) {
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
    // GitHub URL is required so the project can be auto-verified and quality-
    // scored. Without a URL we'd persist a project that can never be verified
    // — the exact bug that left brand-new builders stuck at score=0.
    if (!project.github_url || !project.github_url.trim()) {
      setError("Add a GitHub URL so we can verify and score your project.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const techArray = project.tech_stack
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      // Validate + canonicalize client-side for instant feedback. The API
      // re-validates with the same helper, but we want a clear error here
      // rather than a 400 round-trip.
      const normalizedGithubUrl = normalizeRepoUrl(project.github_url);
      if (!normalizedGithubUrl) {
        setError("GitHub URL must be a valid GitHub repo (e.g. https://github.com/username/repo)");
        setLoading(false);
        return;
      }

      // Route through POST /api/projects rather than a direct insert so the
      // server's auto-verify path (analyzeRepository + quality_score in
      // after()) actually runs. The previous direct-insert path left every
      // onboarding project unverified until the daily verify-backfill cron.
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: project.title,
          description: project.description,
          tech_stack: techArray,
          github_url: normalizedGithubUrl,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save project");
      }

      trackFunnelEvent("onboarding_project_added");
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
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

      // Same path as the dashboard's Log Activity. The browser upsert this
      // replaces showed a raw permission error whenever today's row already
      // existed (github-sync writes one), because streak_logs has no UPDATE
      // policy for the conflict path to use.
      const res = await fetch("/api/streak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: today }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to log streak");
      }
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
              className="w-8 h-8 flex items-center justify-center text-xs font-extrabold border border-[var(--border-hard)]"
              style={{
                backgroundColor:
                  s < step ? "var(--foreground)" : s === step ? "#FF3A00" : "var(--bg-surface)",
                color: s <= step ? "var(--background)" : "var(--foreground)",
              }}
            >
              {s < step ? "✓" : s}
            </div>
            <span className="text-[10px] font-semibold text-[var(--text-secondary)]">
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
      className="p-3 text-sm font-bold text-[var(--status-error-text)] rounded-xl"
      style={{
        backgroundColor: "var(--status-error-bg)",
        border: "1px solid var(--border-subtle)",
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
          className="w-10 h-10 flex items-center justify-center rounded-2xl"
          style={{
            backgroundColor: "#FF3A00",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <Zap size={20} className="text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[var(--foreground)]">
            Profile Basics
          </h2>
          <p className="text-xs text-[var(--text-secondary)] font-medium">
            Tell us who you are
          </p>
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-[var(--text-secondary)] mb-1.5 block">
          Username *
        </label>
        <input
          type="text"
          value={profile.username}
          onChange={(e) =>
            setProfile({
              ...profile,
              username: normalizeUsernameInput(e.target.value),
            })
          }
          placeholder="your_username"
          className="input-brutal w-full"
          required
        />
        <p className="text-[10px] text-[var(--text-secondary)] mt-1">
          Min 3 chars. Lowercase letters, numbers, and underscores only.
        </p>
        {(usernameAvailability.status === "checking" ||
          usernameAvailability.status === "available" ||
          usernameAvailability.status === "taken") && (
          <p
            className="text-[10px] font-bold mt-1"
            style={{
              color:
                usernameAvailability.status === "available"
                  ? "var(--status-success-text)"
                  : usernameAvailability.status === "taken"
                  ? "var(--status-error-text)"
                  : "var(--text-secondary)",
            }}
          >
            {usernameAvailability.status === "checking" && "Checking availability…"}
            {usernameAvailability.status === "available" && "✓ Available"}
            {usernameAvailability.status === "taken" && usernameAvailability.message}
          </p>
        )}
      </div>

      <div>
        <label className="text-xs font-semibold text-[var(--text-secondary)] mb-1.5 block">
          Display Name
        </label>
        <input
          type="text"
          value={profile.display_name}
          onChange={(e) => setProfile({ ...profile, display_name: e.target.value })}
          placeholder="Your display name"
          maxLength={30}
          className="input-brutal w-full"
        />
        <p className="text-[10px] text-[var(--text-secondary)] mt-1">
          Shown above your @username on your profile. Optional but recommended.
        </p>
      </div>

      <div>
        <label className="text-xs font-semibold text-[var(--text-secondary)] mb-1.5 block">
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
          className="w-10 h-10 flex items-center justify-center rounded-2xl"
          style={{
            backgroundColor: "#FF3A00",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <LinkIcon size={20} className="text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[var(--foreground)]">
            Social Links
          </h2>
          <p className="text-xs text-[var(--text-secondary)] font-medium">
            GitHub verifies your work. The rest is optional.
          </p>
        </div>
      </div>

      {userId && (
        <div
          className="flex items-start gap-3 rounded-xl px-4 py-3"
          style={{
            backgroundColor: "var(--bg-surface-light)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <Mail size={18} className="mt-0.5 shrink-0 text-[var(--accent)]" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-[var(--foreground)]">Clients can reach you without a public email</p>
            <p className="mt-1 text-xs font-medium leading-relaxed text-[var(--text-secondary)]">
              Hire requests appear in your VibeTalent inbox.
              {contactEmail ? (
                <> Email alerts go to <span className="font-semibold text-[var(--foreground)] break-all">{contactEmail}</span>.</>
              ) : (
                <> Email alerts are unavailable because this account has no email address.</>
              )}
              {" "}We don&apos;t show this sign-in address on your public profile.
            </p>
          </div>
        </div>
      )}

      {verifiedGithub ? (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{
            backgroundColor: "var(--status-success-bg)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <Github size={18} className="text-[var(--status-success-text)] shrink-0" />
          <span className="font-bold text-[var(--status-success-text)]">@{verifiedGithub}</span>
          <span className="text-xs font-semibold text-[var(--status-success-text)] opacity-70 ml-auto">
            Verified ✓
          </span>
        </div>
      ) : (
        <div>
          {searchParams.get("error_code") === "identity_already_exists" && (
            <div
              className="mb-2 p-3 flex items-start gap-2 text-sm rounded-xl"
              style={{
                backgroundColor: "var(--status-error-bg)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <Github size={16} className="mt-0.5 shrink-0" style={{ color: "var(--status-error-text)" }} />
              <span className="font-bold text-[var(--foreground)]">
                This GitHub account is already linked to another user. Try a different GitHub account or contact support.
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={handleConnectGithub}
            disabled={connectingGithub}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:bg-[var(--bg-pill-hover)] rounded-xl"
            style={{
              backgroundColor: "var(--bg-inverted)",
              border: "1px solid var(--border-subtle)",
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
          placeholder="X / Twitter handle (optional)"
          className="input-brutal w-full"
        />
      </div>

      <div className="flex items-center gap-3">
        <Globe size={18} className="text-[var(--text-secondary)] shrink-0" />
        <input
          type="text"
          value={socials.website}
          onChange={(e) => setSocials({ ...socials, website: e.target.value })}
          placeholder="https://your-website.com (optional)"
          className="input-brutal w-full"
        />
      </div>

      <div className="flex items-center gap-3">
        <TelegramIcon size={18} className="text-[var(--text-secondary)] shrink-0" />
        <input
          type="text"
          value={socials.telegram}
          onChange={(e) => setSocials({ ...socials, telegram: e.target.value })}
          placeholder="Telegram username (optional)"
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
          className="w-10 h-10 flex items-center justify-center rounded-2xl"
          style={{
            backgroundColor: "#FF3A00",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <FolderGit2 size={20} className="text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[var(--foreground)]">
            First Project
          </h2>
          <p className="text-xs text-[var(--text-secondary)] font-medium">
            Showcase what you&apos;re building (optional)
          </p>
        </div>
      </div>

      <GithubRepoPicker
        selectedUrl={project.github_url}
        onSelect={(repo) => {
          setProject({
            title: repo.name,
            description: repo.description,
            tech_stack: repo.language,
            github_url: repo.github_url,
          });
          setError("");
        }}
      />

      <div>
        <label className="text-xs font-semibold text-[var(--text-secondary)] mb-1.5 block">
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
        <label className="text-xs font-semibold text-[var(--text-secondary)] mb-1.5 block">
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
        <label className="text-xs font-semibold text-[var(--text-secondary)] mb-1.5 block">
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
        <label className="text-xs font-semibold text-[var(--text-secondary)] mb-1.5 block">
          GitHub URL *
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
        <p className="text-[10px] text-[var(--text-secondary)] mt-1">
          Required — we use this to auto-verify ownership and score your project.
        </p>
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
          if (!isRecovery) trackFunnelEvent("onboarding_project_skipped");
          setStep(4);
        }}
        className="w-full text-center text-xs font-semibold text-[var(--text-secondary)] hover:text-[#FF3A00] transition-colors"
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
          className="w-10 h-10 flex items-center justify-center rounded-2xl"
          style={{
            backgroundColor: "#FF3A00",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <Flame size={20} className="text-white" />
        </div>
        <div className="text-left">
          <h2 className="text-xl font-bold text-[var(--foreground)]">
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
            className="p-8 rounded-2xl"
            style={{
              backgroundColor: "var(--bg-surface-light)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <Flame
              size={48}
              className="mx-auto mb-4"
              style={{ color: "#FF3A00" }}
            />
            <p className="text-sm font-bold text-[var(--foreground)] mb-1">
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
            className="p-8 rounded-2xl"
            style={{
              backgroundColor: "var(--status-success-bg)",
              border: "1px solid var(--border-subtle)",
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
            <p className="text-lg font-bold text-[var(--foreground)]">
              Streak Started!
            </p>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              You&apos;re officially a builder. Keep it going!
            </p>
          </div>

          <a
            href="https://t.me/vibetalentwork"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Join the VibeTalent Telegram community (opens in new tab)"
            className="flex items-center gap-3 p-4 text-left transition-all hover:-translate-y-0.5 rounded-xl"
            style={{
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              boxShadow: "var(--shadow-brutal-sm)",
            }}
          >
            <div
              className="shrink-0 w-10 h-10 flex items-center justify-center"
              style={{ backgroundColor: "#229ED9", color: "white" }}
            >
              <TelegramIcon size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[var(--foreground)]">
                Join our Telegram
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Where builders ship in public — @vibetalentwork
              </p>
            </div>
            <ArrowRight size={16} className="shrink-0 text-[var(--text-muted)]" />
          </a>

          <button
            type="button"
            onClick={async () => {
              // Never throws; a referral that can't be credited yet is retried
              // from the dashboard.
              await submitPendingReferral();
              // Drop a one-time in-app nudge so new builders share their referral link.
              fetch("/api/notifications/welcome-referral", { method: "POST" }).catch(() => {});
              // Arm the onboarding tour so the dashboard fires it on mount.
              // Gated on the env flag so flipping the kill-switch never leaves
              // a stale signal sitting in the user's tab.
              if (TOUR_FLAG_ENABLED) armTourTrigger();
              if (!isRecovery) trackFunnelEvent("onboarding_completed");
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
          className="inline-flex items-center justify-center w-14 h-14 mb-4 rounded-2xl"
          style={{
            backgroundColor: "#FF3A00",
            border: "1px solid var(--border-subtle)",
            boxShadow: "var(--shadow-brutal)",
          }}
        >
          <Flame size={28} className="text-white" />
        </div>
        <h1 className="text-3xl font-bold text-[var(--foreground)]">
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
        className="p-6 rounded-2xl"
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
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
