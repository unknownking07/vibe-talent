"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { fetchStreakLogs } from "@/lib/supabase/queries";
import { siteUrl } from "@/lib/seo";
import { normalizeExternalUrl, normalizeRepoUrl } from "@/lib/url-normalize";
import { BadgeDisplay } from "@/components/ui/badge-display";
import type { UserWithSocials } from "@/lib/types/database";
import { StreakCounter } from "@/components/ui/streak-counter";
import { ActivityHeatmap } from "@/components/ui/activity-heatmap";
import { ProjectCard } from "@/components/ui/project-card";
import { ProfileViewsWidget } from "@/components/dashboard/profile-views-widget";
import { StreakMilestone } from "@/components/dashboard/streak-milestone";
import { consumeTourTrigger, TOUR_FLAG_ENABLED } from "@/lib/onboarding";
import type { HireRequest, HireMessage } from "@/lib/types/database";
import {
  Plus,
  Save,
  Flame,
  Trophy,
  Code2,
  X,
  Clock,
  Check,
  Inbox,
  Mail,
  MailOpen,
  DollarSign,
  Send,
  MessageCircle,
  User,
  Wrench,
  ExternalLink,
  Camera,
  Trash2,
  ShieldCheck,
  Zap,
} from "lucide-react";

// Column lists for the dashboard's own queries, kept to what the page (plus
// the GitHub self-heal and mandatory-socials gating) actually reads, instead
// of the `select("*")` that paid full-row egress on every visit.
//
// quality_metrics IS required despite being JSONB: QualityScoreBadge renders
// its Community/Substance/Maintenance breakdown from it (and silently falls
// back to a generic checklist without it), and the Badge Holder chip reads
// has_vibetalent_badge. It's a flat ~13-key object, so the egress is trivial.
const DASHBOARD_USER_FIELDS =
  "id, username, display_name, bio, avatar_url, github_username, vibe_score, streak, longest_streak, badge_level, streak_freezes_remaining, streak_freezes_used, referral_count, created_at";
const DASHBOARD_PROJECT_FIELDS =
  "id, user_id, title, description, tech_stack, live_url, github_url, image_url, build_time, tags, verified, quality_score, quality_metrics, endorsement_count, created_at";
const DASHBOARD_SOCIAL_FIELDS = "id, user_id, twitter, telegram, github, website, farcaster";
const INBOX_FIELDS = "id, sender_name, sender_email, budget, message, status, reply, replied_at, created_at";

// Lazy: only loaded when the tour is actually armed (post-signup or ?tour=force).
// Keeps the ~300-line tour module + its deps out of the initial dashboard chunk.
const OnboardingTour = dynamic(
  () => import("@/components/onboarding/onboarding-tour").then((m) => m.OnboardingTour),
  { ssr: false }
);

// Isolated 1Hz timer so it does not re-render the entire DashboardPage tree
// (heatmap, project cards, milestone, etc.) every second. With this lifted
// out, the per-second update only re-renders ~3 DOM nodes; left in the
// parent, an open dashboard tab built up enough reconciliation work over
// hours to noticeably slow the browser.
function MidnightCountdown({ onMidnight }: { onMidnight: () => void }) {
  const [label, setLabel] = useState("");
  // Read the latest callback via ref so a changing prop identity does not
  // restart the interval on every parent re-render.
  const onMidnightRef = useRef(onMidnight);
  useEffect(() => {
    onMidnightRef.current = onMidnight;
  }, [onMidnight]);

  useEffect(() => {
    // Detect midnight rollover by comparing the local calendar date
    // between ticks. We can't use a `diff <= 0` check against the next
    // midnight: setHours(24, 0, 0, 0) always produces *next* midnight,
    // so the moment we cross 00:00 the target jumps a full 24h ahead and
    // diff is never ≤ 0. The previous in-parent implementation had the
    // same bug — a user who left the dashboard open across midnight
    // would see the countdown wrap to "21:00:00" instead of resetting.
    let prevLocalDate: string | null = null;

    const tick = () => {
      // Skip while the tab is hidden — the visibilitychange handler
      // calls tick() the moment the user returns, which both re-syncs
      // the display and catches a crossed-midnight rollover.
      if (document.hidden) return;
      const now = new Date();
      const today = now.toDateString();
      if (prevLocalDate !== null && prevLocalDate !== today) {
        // Update the ref before firing so a duplicate tick (setInterval
        // racing with visibilitychange) does not re-trigger onMidnight
        // before the parent unmounts this component.
        prevLocalDate = today;
        onMidnightRef.current();
        return;
      }
      prevLocalDate = today;

      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      const diff = midnight.getTime() - now.getTime();
      const hours = Math.floor(diff / 3_600_000);
      const minutes = Math.floor((diff % 3_600_000) / 60_000);
      const seconds = Math.floor((diff % 60_000) / 1000);
      setLabel(
        `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
      );
    };
    tick();
    const interval = setInterval(tick, 1000);
    // Re-sync immediately when the tab becomes visible after being hidden,
    // otherwise the displayed value would lag by up to a second and a
    // crossed-midnight rollover would wait for the next setInterval tick.
    const onVisibility = () => { if (!document.hidden) tick(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <>{label}</>;
}

export default function DashboardPage() {
  const [user, setUser] = useState<UserWithSocials | null>(null);
  const [heatmapData, setHeatmapData] = useState<Record<string, number>>({});
  const [ghTotal, setGhTotal] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [hireRequests, setHireRequests] = useState<HireRequest[]>([]);
  // Seed for the Inbox tab's "new" badge: a head-count fetched on initial
  // load (the full list is deferred until the tab is opened). Once the list
  // has loaded, the badge derives from it directly — see newHireCount below —
  // so mark-read / delete / reply need no manual counter bookkeeping.
  const [newHireSeed, setNewHireSeed] = useState(0);
  const [inboxLoaded, setInboxLoaded] = useState(false);
  const [inboxError, setInboxError] = useState<string | null>(null);
  const [senderProfiles, setSenderProfiles] = useState<Record<string, { username: string }>>({});
  // Onboarding tour visibility. Initialized false on the server (SSR-safe);
  // the effect below reads the sessionStorage trigger or `?tour=force` query
  // param on mount and flips it on. Kept separate from `forceOpen` (passed
  // to the modal) so the dev-replay path can bypass the env-var check
  // without changing how the production trigger is recorded.
  const [showTour, setShowTour] = useState(false);
  const [tourForceOpen, setTourForceOpen] = useState(false);

  // One-shot tour trigger. Runs once on mount (empty deps), reads two signals:
  //   1. The `vibetalent_show_tour_after_redirect` sessionStorage key set by
  //      profile-setup step 4. Consumed-on-read so reloads don't replay.
  //   2. `?tour=force` query param for dev-replay (also consumed by reading
  //      `window.location.search` directly — no Suspense-boundary needed for
  //      `useSearchParams`).
  // Both paths require TOUR_FLAG_ENABLED. Gating `?tour=force` on the flag
  // too is critical for the kill-switch contract: if we disable the tour in
  // prod, no URL trick should bring it back. Use `/dev/tour-preview` (which
  // is NODE_ENV-gated) for development previews instead.
  //
  // We also listen for a "vibetalent-tour-replay" window event so the navbar
  // "Replay tour" button works when the user is already on /dashboard. Without
  // this, router.push("/dashboard") from the navbar is a no-op (Next.js sees
  // the same route, doesn't remount), so the mount-only signals above never
  // re-fire.
  useEffect(() => {
    if (!TOUR_FLAG_ENABLED) return;
    const forced =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("tour") === "force";
    if (forced) {
      setTourForceOpen(true);
      setShowTour(true);
      return;
    }
    if (consumeTourTrigger()) {
      setShowTour(true);
    }
  }, []);

  // Same-page replay: navbar dispatches this when the user clicks "Replay
  // tour" while already on /dashboard. We re-consume the trigger and open
  // the modal without a route change.
  useEffect(() => {
    if (!TOUR_FLAG_ENABLED) return;
    const handleReplay = () => {
      if (consumeTourTrigger()) {
        setTourForceOpen(false);
        setShowTour(true);
      }
    };
    window.addEventListener("vibetalent-tour-replay", handleReplay);
    return () => window.removeEventListener("vibetalent-tour-replay", handleReplay);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let loaded = false;

    async function loadUserData(authUser: import("@supabase/supabase-js").User) {
      if (loaded || cancelled) return;
      loaded = true;
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;

      try {
      // Fetch profile + projects + socials + streaks + inbox badge ALL in
      // parallel (single round trip). The inbox itself is deferred: the old
      // hire_requests fetch pulled every request ever received — full message
      // bodies included — plus a resolve-senders API call on every dashboard
      // visit, just to derive the tab's "new" badge. A head-count covers the
      // badge; the Inbox tab loads the real list via loadInbox() when opened.
      const results = await Promise.allSettled([
        sb.from("users").select(DASHBOARD_USER_FIELDS).eq("id", authUser.id).maybeSingle(),
        sb.from("projects").select(DASHBOARD_PROJECT_FIELDS).eq("user_id", authUser.id).order("created_at", { ascending: false }),
        sb.from("social_links").select(DASHBOARD_SOCIAL_FIELDS).eq("user_id", authUser.id).maybeSingle(),
        fetchStreakLogs(authUser.id),
        sb.from("hire_requests").select("id", { count: "exact", head: true }).eq("builder_id", authUser.id).eq("status", "new"),
      ]);

      const profile = results[0].status === "fulfilled" ? results[0].value?.data : null;
      const projects = results[1].status === "fulfilled" ? results[1].value?.data : [];
      // `let` because the GitHub self-heal block below may overwrite this in
      // memory after a fire-and-forget DB upsert.
      let socials = results[2].status === "fulfilled" ? results[2].value?.data : null;
      const streakData = results[3].status === "fulfilled" ? results[3].value : {};
      setNewHireSeed(results[4].status === "fulfilled" ? results[4].value?.count || 0 : 0);

      if (!profile) {
        window.location.href = "/auth/profile-setup";
        return;
      }

      // Self-heal: if the GitHub identity is attached in auth.users but the
      // mirror columns (users.github_username / social_links.github) are out
      // of sync, repair them in place so the missing-socials redirect below
      // doesn't bounce the user into an unfixable loop. Same lookup pattern
      // as settings/page.tsx and profile-setup/page.tsx.
      if (!profile.github_username || !socials?.github) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ghIdentity = authUser.identities?.find((i: any) => i.provider === "github");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ghData = (ghIdentity?.identity_data ?? {}) as any;
        const ghUsername =
          ghData.user_name ||
          ghData.preferred_username ||
          authUser.user_metadata?.user_name ||
          authUser.user_metadata?.preferred_username ||
          null;
        if (ghUsername) {
          if (!profile.github_username) {
            profile.github_username = ghUsername;
            sb.from("users").update({ github_username: ghUsername }).eq("id", authUser.id);
          }
          if (!socials?.github) {
            socials = { ...(socials || {}), github: ghUsername, user_id: authUser.id };
            sb.from("social_links").upsert(
              { user_id: authUser.id, github: ghUsername },
              { onConflict: "user_id" }
            );
          }
        }
      }

      // Enforce mandatory socials: GitHub + (X or Telegram)
      const hasGithub = socials?.github?.trim();
      const hasTwitter = socials?.twitter?.trim();
      const hasTelegram = socials?.telegram?.trim();
      if (!hasGithub || (!hasTwitter && !hasTelegram)) {
        window.location.href = "/auth/profile-setup?step=2";
        return;
      }
      setHeatmapData(streakData);

      // Calculate actual streak from streak_logs (in case DB trigger didn't run)
      const dates = Object.keys(streakData).sort().reverse();
      const nowLocal = new Date();
      const today = `${nowLocal.getFullYear()}-${String(nowLocal.getMonth() + 1).padStart(2, "0")}-${String(nowLocal.getDate()).padStart(2, "0")}`;
      // Set todayLogged from the streakData we already fetched, instead of
      // firing a second streak_logs query after first render. Eliminates one
      // post-paint roundtrip on every dashboard visit.
      if (streakData[today]) {
        setTodayLogged(true);
      }
      let calculatedStreak = 0;
      if (dates.length > 0) {
        const yLocal = new Date(nowLocal.getTime() - 86400000);
        const yesterday = `${yLocal.getFullYear()}-${String(yLocal.getMonth() + 1).padStart(2, "0")}-${String(yLocal.getDate()).padStart(2, "0")}`;
        // Only count if latest log is today or yesterday
        if (dates[0] === today || dates[0] === yesterday) {
          calculatedStreak = 1;
          for (let i = 1; i < dates.length; i++) {
            const curr = new Date(dates[i - 1]);
            const prev = new Date(dates[i]);
            const diffDays = (curr.getTime() - prev.getTime()) / 86400000;
            if (diffDays === 1) {
              calculatedStreak++;
            } else {
              break;
            }
          }
        }
      }

      const actualStreak = Math.max(profile.streak || 0, calculatedStreak);
      const actualLongest = Math.max(profile.longest_streak || 0, calculatedStreak);

      // Show UI immediately, don't wait for DB sync
      // vibe_score is computed by the DB trigger — use the value from the profile
      setUser({
        ...profile,
        streak: actualStreak,
        longest_streak: actualLongest,
        projects: projects || [],
        social_links: socials || null,
      });
      setLoading(false);

      // Recompute streak/score server-side so the profile page stays in sync.
      // Routed through the SECURITY DEFINER update_user_streak RPC rather than a
      // direct column write: reputation columns (streak / vibe_score /
      // badge_level) are no longer client-writable (see the 20260529 security
      // migration), and the RPC derives them authoritatively from streak_logs.
      if (actualStreak !== (profile.streak || 0) || actualLongest !== (profile.longest_streak || 0)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (sb as any).rpc("update_user_streak", { p_user_id: authUser.id }).then(() => {});
      }

      // Auto-sync GitHub if configured and hasn't synced recently
      if (socials?.github) {
        const lastSync = localStorage.getItem("last_github_sync");
        const oneHourAgo = Date.now() - 3600000;
        if (!lastSync || Number(lastSync) < oneHourAgo) {
          localStorage.setItem("last_github_sync", Date.now().toString());
          fetch("/api/github/activity", { method: "POST" })
            .then(res => res.json())
            .then(data => {
              if (data.synced && data.dates_logged > 0) {
                // Re-fetch streak data and update UI after successful sync
                fetchStreakLogs(authUser.id).then(newStreakData => {
                  // Merge with existing heatmap (GitHub contributions take priority)
                  setHeatmapData(prev => ({ ...newStreakData, ...prev }));
                  // Re-check if today was logged
                  const nowLocal = new Date();
                  const todayStr = `${nowLocal.getFullYear()}-${String(nowLocal.getMonth() + 1).padStart(2, "0")}-${String(nowLocal.getDate()).padStart(2, "0")}`;
                  if (newStreakData[todayStr]) {
                    setTodayLogged(true);
                    // Tell navbar the dot can drop — GitHub activity filled
                    // today's slot without a manual log.
                    window.dispatchEvent(new Event("streak-updated"));
                  }
                  // Recalculate streak from new data
                  const newDates = Object.keys(newStreakData).sort().reverse();
                  let newStreak = 0;
                  if (newDates.length > 0) {
                    const yLocal = new Date(nowLocal.getTime() - 86400000);
                    const yesterdayStr = `${yLocal.getFullYear()}-${String(yLocal.getMonth() + 1).padStart(2, "0")}-${String(yLocal.getDate()).padStart(2, "0")}`;
                    if (newDates[0] === todayStr || newDates[0] === yesterdayStr) {
                      newStreak = 1;
                      for (let i = 1; i < newDates.length; i++) {
                        const curr = new Date(newDates[i - 1]);
                        const prev = new Date(newDates[i]);
                        if ((curr.getTime() - prev.getTime()) / 86400000 === 1) {
                          newStreak++;
                        } else break;
                      }
                    }
                  }
                  setUser(prev => prev ? {
                    ...prev,
                    streak: Math.max(prev.streak, newStreak),
                    longest_streak: Math.max(prev.longest_streak, newStreak),
                  } : prev);
                });
              }
            })
            .catch(console.error);
        }

        // Fetch full GitHub contribution graph (runs in background).
        // Cached in localStorage for 1 hour so revisits within the same hour
        // paint the heatmap instantly without a GitHub API roundtrip. The
        // server endpoint also has a 1hr s-maxage, so a stale client cache
        // and a fresh server hit produce equivalent data.
        //
        // Keys are scoped by auth user id so a second account signing in on
        // the same browser within the 1h window can't see the previous
        // user's heatmap.
        const GH_CONTRIB_CACHE = `last_github_contributions_cache:${authUser.id}`;
        const GH_CONTRIB_TS = `last_github_contributions_ts:${authUser.id}`;
        const applyGhData = (ghData: { total?: number; contributions?: Record<string, number> }) => {
          if (ghData.total) setGhTotal(ghData.total);
          if (ghData.contributions && Object.keys(ghData.contributions).length > 0) {
            setHeatmapData(prev => {
              // Merge: GitHub contributions as base, streak_logs overlay
              const merged: Record<string, number> = { ...ghData.contributions };
              for (const [date, level] of Object.entries(prev)) {
                // Keep the higher value between GitHub data and streak logs
                if (!merged[date] || (level as number) > merged[date]) {
                  merged[date] = level;
                }
              }
              return merged;
            });
          }
        };
        const cachedTs = localStorage.getItem(GH_CONTRIB_TS);
        const cachedRaw = localStorage.getItem(GH_CONTRIB_CACHE);
        const oneHourAgoMs = Date.now() - 3_600_000;
        let usedFreshCache = false;
        if (cachedTs && Number(cachedTs) > oneHourAgoMs && cachedRaw) {
          try {
            applyGhData(JSON.parse(cachedRaw));
            usedFreshCache = true;
          } catch {
            // Corrupt cache — fall through to network fetch.
          }
        }
        if (!usedFreshCache) {
          fetch("/api/github/contributions")
            .then(async res => {
              // Only treat 2xx as fresh data. A 401/4xx/5xx body would
              // otherwise get persisted as a "good" cache for an hour and
              // mask transient outages.
              if (!res.ok) return null;
              try {
                return await res.json();
              } catch {
                return null;
              }
            })
            .then(ghData => {
              if (!ghData) return;
              try {
                localStorage.setItem(GH_CONTRIB_CACHE, JSON.stringify(ghData));
                localStorage.setItem(GH_CONTRIB_TS, Date.now().toString());
              } catch {
                // Quota / private mode — best-effort.
              }
              applyGhData(ghData);
            })
            .catch(console.error);
        }
      }

      } catch (err) {
        console.error("Dashboard loadUserData failed:", err);
        setLoading(false);
      }
    }

    // Try immediate auth check first
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      if (cancelled) return;
      if (authUser) {
        loadUserData(authUser);
      }
    });

    // Also listen for auth state changes — catches the case where
    // session isn't ready yet after OAuth redirect / profile setup
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      if (session?.user) {
        loadUserData(session.user);
      } else {
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const [showProjectForm, setShowProjectForm] = useState(false);
  const [projectError, setProjectError] = useState("");
  const [projectForm, setProjectForm] = useState({
    title: "",
    description: "",
    tech_stack: "",
    live_url: "",
    github_url: "",
    build_time: "",
    tags: "",
  });

  const [todayLogged, setTodayLogged] = useState(false);
  const [logging, setLogging] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);
  const [addingProject, setAddingProject] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingOriginalGithubUrl, setEditingOriginalGithubUrl] = useState<string>("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "inbox">("overview");
  const [loadingInbox, setLoadingInbox] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [chatMessages, setChatMessages] = useState<Record<string, HireMessage[]>>({});
  const [loadingChat, setLoadingChat] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatPollRef = useRef<NodeJS.Timeout | null>(null);
  const [badgeCopied, setBadgeCopied] = useState<string | null>(null);
  const [verifyingProjectId, setVerifyingProjectId] = useState<string | null>(null);
  const [verifyMessage, setVerifyMessage] = useState<{ projectId: string; success: boolean; text: string } | null>(null);
  const [showVerifyGuide, setShowVerifyGuide] = useState(true);
  const [projectImageFile, setProjectImageFile] = useState<File | null>(null);
  const [projectImagePreview, setProjectImagePreview] = useState<string | null>(null);
  // Tracks blob: URLs we created via URL.createObjectURL so we can revoke
  // them on replacement / unmount. The Supabase public URLs that come back
  // when editing an existing project are not blob URLs and must not be revoked.
  const previewBlobUrlRef = useRef<string | null>(null);
  const projectImageInputRef = useRef<HTMLInputElement>(null);
  const [imageDragging, setImageDragging] = useState(false);
  const [imageProcessing, setImageProcessing] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [syncingGithub, setSyncingGithub] = useState(false);
  const [githubSyncResult, setGithubSyncResult] = useState<string | null>(null);
  const [lastSyncLabel, setLastSyncLabel] = useState<string | null>(null);

  useEffect(() => {
    const ts = localStorage.getItem("last_github_sync");
    if (ts) {
      const diff = Date.now() - Number(ts);
      const mins = Math.floor(diff / 60000);
      if (mins < 1) setLastSyncLabel("just now");
      else if (mins < 60) setLastSyncLabel(`${mins}m ago`);
      else {
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) setLastSyncLabel(`${hrs}h ago`);
        else setLastSyncLabel(`${Math.floor(hrs / 24)}d ago`);
      }
    }
  }, []);

  const reloadUser = useCallback(async () => {
    const supabase = createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const { data: profile } = await sb.from("users").select(DASHBOARD_USER_FIELDS).eq("id", authUser.id).maybeSingle();
    if (!profile) return;
    const [{ data: projects }, { data: socials }, streakData] = await Promise.all([
      sb.from("projects").select(DASHBOARD_PROJECT_FIELDS).eq("user_id", authUser.id).order("created_at", { ascending: false }),
      sb.from("social_links").select(DASHBOARD_SOCIAL_FIELDS).eq("user_id", authUser.id).maybeSingle(),
      fetchStreakLogs(authUser.id),
    ]);
    setUser({ ...profile, projects: projects || [], social_links: socials || null });
    setHeatmapData(streakData);
    // Keep `todayLogged` in sync with the refreshed streak data. Callers like
    // handleAddProject auto-upsert a streak_logs row for today, and without
    // this the sidebar would still show "Log Activity" until the next mount.
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    if (streakData[today]) setTodayLogged(true);
  }, []);

  const verifyProject = async (projectId: string) => {
    setVerifyingProjectId(projectId);
    setVerifyMessage(null);
    try {
      const res = await fetch("/api/projects/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId }),
      });
      const data = await res.json();
      if (data.verified) {
        setVerifyMessage({ projectId, success: true, text: data.reason || "Project verified!" });
        await reloadUser();
      } else {
        setVerifyMessage({
          projectId,
          success: false,
          text: data.reason || "Verification failed.",
        });
      }
    } catch {
      setVerifyMessage({ projectId, success: false, text: "Verification request failed." });
    }
    setVerifyingProjectId(null);
  };

  const setPreviewBlobUrl = (blob: Blob | null) => {
    if (previewBlobUrlRef.current) {
      URL.revokeObjectURL(previewBlobUrlRef.current);
      previewBlobUrlRef.current = null;
    }
    if (blob) {
      const url = URL.createObjectURL(blob);
      previewBlobUrlRef.current = url;
      setProjectImagePreview(url);
    } else {
      setProjectImagePreview(null);
    }
  };

  const validateAndSetImage = async (file: File) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      setImageError('Only JPG, PNG, WebP, and GIF images are allowed');
      return;
    }

    // Source cap is generous (20MB) because we re-encode to ~1600x900 JPEG
    // q80 below — typical processed output lands under 300KB regardless of
    // how large the source is.
    if (file.size > 20 * 1024 * 1024) {
      setImageError('Image must be under 20MB');
      return;
    }

    setImageError(null);
    setImageProcessing(true);
    try {
      // Lazy-load the image processor — keeps the canvas/codec helpers
      // out of the initial dashboard bundle. Users who never open the
      // Add Project form never pay for this module.
      const { processProjectImage } = await import("@/lib/image-processing");
      const processed = await processProjectImage(file);
      const processedFile = new File([processed], "image.jpg", {
        type: "image/jpeg",
        lastModified: Date.now(),
      });
      setProjectImageFile(processedFile);
      setPreviewBlobUrl(processed);
    } catch (err) {
      console.error("[dashboard] image processing failed:", err);
      setImageError("Couldn't process this image. Try a different file.");
    } finally {
      setImageProcessing(false);
    }
  };

  const handleProjectImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset the input so picking the same file again still fires onChange.
    e.target.value = "";
    if (!file) return;
    void validateAndSetImage(file);
  };

  // Clipboard paste: while the form is open, intercept image paste events
  // (screenshots, copied web images) and route them through the same
  // processor. We only consume image clipboard items — text paste is
  // untouched so users can still paste descriptions, URLs, etc.
  useEffect(() => {
    if (!showProjectForm) return;
    const handler = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            void validateAndSetImage(file);
            return;
          }
        }
      }
    };
    window.addEventListener("paste", handler);
    return () => window.removeEventListener("paste", handler);
    // validateAndSetImage is stable enough — it only reads setters, which
    // React guarantees are stable. Re-attaching on each render would tear
    // down/up the listener unnecessarily.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showProjectForm]);

  // Revoke any outstanding blob: preview URL on unmount.
  useEffect(() => {
    return () => {
      if (previewBlobUrlRef.current) {
        URL.revokeObjectURL(previewBlobUrlRef.current);
        previewBlobUrlRef.current = null;
      }
    };
  }, []);

  const handleGithubSync = async () => {
    if (syncingGithub || !user) return;
    setSyncingGithub(true);
    setGithubSyncResult(null);
    try {
      const res = await fetch("/api/github/activity", { method: "POST" });
      const data = await res.json();
      if (data.synced) {
        localStorage.setItem("last_github_sync", Date.now().toString());
        setLastSyncLabel("just now");
        setGithubSyncResult(`\u2713 Synced! Found ${data.events_found} events, logged ${data.dates_logged} day(s).`);
        await reloadUser();
        // Update heatmap
        const streakData = await fetchStreakLogs(user.id);
        setHeatmapData(streakData);
        // If today is now in streak_logs, clear the dot without a reload.
        const nowLocal = new Date();
        const todayStr = `${nowLocal.getFullYear()}-${String(nowLocal.getMonth() + 1).padStart(2, "0")}-${String(nowLocal.getDate()).padStart(2, "0")}`;
        if (streakData[todayStr]) {
          setTodayLogged(true);
        }
        window.dispatchEvent(new Event("streak-updated"));
      } else if (data.error) {
        setGithubSyncResult(`\u26A0 ${data.error}`);
      } else {
        setGithubSyncResult("No recent GitHub activity found.");
      }
    } catch {
      setGithubSyncResult("Failed to sync GitHub activity.");
    }
    setSyncingGithub(false);
    // Clear message after 5 seconds
    setTimeout(() => setGithubSyncResult(null), 5000);
  };

  // Fetch the inbox directly from Supabase (skip API route hop). Called when
  // the Inbox tab is opened — the initial dashboard load only fetches the
  // "new" head-count for the tab badge.
  const loadInbox = async () => {
    setLoadingInbox(true);
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("hire_requests")
      .select(INBOX_FIELDS)
      .eq("builder_id", user?.id)
      .order("created_at", { ascending: false });
    // A failed query is not an empty inbox. Swallowing the error here would
    // render "No hire requests yet" over real requests and — because the tab
    // badge switches to deriving from this list once inboxLoaded flips — also
    // clear the unread count the initial head-count had correctly seeded.
    if (error) {
      console.error("[dashboard] inbox fetch failed:", error);
      setInboxError("Couldn't load your inbox. Check your connection and try again.");
      setLoadingInbox(false);
      return;
    }
    const list: HireRequest[] = data || [];
    setInboxError(null);
    setHireRequests(list);
    setInboxLoaded(true);
    setLoadingInbox(false);

    // Resolve hire request senders → profiles. The server only resolves
    // requests where sender_user_id was captured at submission time (i.e.,
    // the sender was logged in and their auth email matched the form email),
    // so an unauthenticated form spoof can never link to a victim's profile.
    // Fire-and-forget; failures keep names as plain text.
    if (list.length > 0) {
      const ids = list.map((r) => r.id).slice(0, 100);
      fetch("/api/hire/resolve-senders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hire_request_ids: ids }),
      })
        .then((r) => {
          if (!r.ok) {
            console.warn("[dashboard] resolve-senders non-ok:", r.status);
            return null;
          }
          return r.json();
        })
        .then((data) => {
          if (data?.resolved) {
            setSenderProfiles(data.resolved);
          }
        })
        .catch((err) => {
          console.warn("[dashboard] resolve-senders failed:", err);
        });
    }
  };

  const handleMarkAsRead = async (requestId: string) => {
    try {
      const res = await fetch("/api/hire", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: requestId, status: "read" }),
      });
      if (res.ok) {
        setHireRequests((prev) =>
          prev.map((r) => (r.id === requestId ? { ...r, status: "read" } : r))
        );
      }
    } catch (err) {
      console.error("Failed to mark as read:", err);
    }
  };

  const handleDeleteRequest = async (requestId: string) => {
    try {
      const res = await fetch("/api/hire", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: requestId }),
      });
      if (res.ok) {
        setHireRequests((prev) => prev.filter((r) => r.id !== requestId));
        if (replyingTo === requestId) setReplyingTo(null);
      }
    } catch (err) {
      console.error("Failed to delete request:", err);
    }
  };

  const loadChatMessages = async (requestId: string) => {
    try {
      const res = await fetch(`/api/hire/messages?hire_request_id=${requestId}`);
      if (res.ok) {
        const data = await res.json();
        setChatMessages((prev) => ({ ...prev, [requestId]: data.messages || [] }));
      }
    } catch (err) {
      console.error("Failed to load chat messages:", err);
    }
  };

  const handleOpenChat = async (requestId: string) => {
    if (replyingTo === requestId) {
      // Close chat
      setReplyingTo(null);
      setReplyText("");
      if (chatPollRef.current) {
        clearInterval(chatPollRef.current);
        chatPollRef.current = null;
      }
      return;
    }
    setReplyingTo(requestId);
    setReplyText("");
    setLoadingChat(requestId);
    await loadChatMessages(requestId);
    setLoadingChat(null);

    // Poll for new messages
    if (chatPollRef.current) clearInterval(chatPollRef.current);
    chatPollRef.current = setInterval(() => loadChatMessages(requestId), 15000);
  };

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (chatPollRef.current) clearInterval(chatPollRef.current);
    };
  }, []);

  const handleSendReply = async (requestId: string) => {
    if (!replyText.trim() || sendingReply) return;
    setSendingReply(true);
    try {
      const res = await fetch("/api/hire/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hire_request_id: requestId,
          sender_type: "builder",
          message: replyText.trim(),
        }),
      });
      if (res.ok) {
        const { data: newMsg } = await res.json();
        setChatMessages((prev) => ({
          ...prev,
          [requestId]: [...(prev[requestId] || []), newMsg],
        }));
        setHireRequests((prev) =>
          prev.map((r) =>
            r.id === requestId
              ? { ...r, status: "replied", reply: r.reply || replyText.trim(), replied_at: r.replied_at || new Date().toISOString() }
              : r
          )
        );
        setReplyText("");
      }
    } catch (err) {
      console.error("Failed to send reply:", err);
    }
    setSendingReply(false);
  };

  // `todayLogged` is seeded from the initial streakData fetch in loadUserData
  // (no separate roundtrip), and kept in sync by:
  //   - handleLogActivity (manual log) — sets true after a successful POST.
  //   - GitHub auto-sync (line ~330+) — sets true if today shows up in fresh data.
  //   - handleMidnight — resets to false at 00:00.

  // Midnight rollover handler — fires from <MidnightCountdown /> when the
  // countdown ticks past 00:00. Resets the local state so the user can log
  // again, tells the navbar to bring the unlogged-today dot back, and
  // refreshes the profile so streak/badge values reflect the new day.
  const handleMidnight = useCallback(() => {
    setTodayLogged(false);
    window.dispatchEvent(new Event("streak-updated"));
    reloadUser();
  }, [reloadUser]);

  const handleLogActivity = async () => {
    if (!user || todayLogged || logging) return;
    setLogError(null);
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    // Paint the result BEFORE the network call, not after.
    //
    // A log round-trips browser → Cloudflare edge → GoTrue (Seoul) → Postgres
    // (Seoul) → back: three serial hops, ~350-500ms at best, over a second on
    // a cold Worker, and roughly double that when the access token is stale
    // (the 401 path below re-auths and re-posts). Blocking the button on all
    // of that left it sitting on "Logging…" long enough to feel broken.
    //
    // Safe to do optimistically because the write is idempotent: the server
    // upserts against the unique (user_id, activity_date) index, so a retry —
    // or a double click that slips through — converges on the same single row.
    // Every field touched here is restored by `rollback` if the write fails.
    const prevStreak = user.streak;
    const prevLongest = user.longest_streak;
    const optimisticStreak = prevStreak + 1;

    setUser((u) =>
      u ? { ...u, streak: optimisticStreak, longest_streak: Math.max(optimisticStreak, u.longest_streak) } : u
    );
    setHeatmapData((h) => ({ ...h, [today]: (h[today] || 0) + 1 }));
    setTodayLogged(true);
    setLogging(true);

    // Undo the optimistic paint. Uses functional updates and adjusts only
    // today's cell rather than restoring a whole snapshot — the GitHub sync
    // running in the background may legitimately have written other days while
    // this request was in flight, and clobbering those would lose real data.
    const rollback = () => {
      setUser((u) => (u ? { ...u, streak: prevStreak, longest_streak: prevLongest } : u));
      setHeatmapData((h) => {
        const next = { ...h };
        const remaining = (next[today] ?? 1) - 1;
        if (remaining > 0) next[today] = remaining;
        else delete next[today];
        return next;
      });
      setTodayLogged(false);
      setLogging(false);
    };

    // Route through the server API (admin client, upsert-safe). Previously this
    // page inserted via the browser Supabase client, which 404'd in production
    // due to RLS/JWT edge cases and left the user clicking with no feedback.
    const postStreak = () =>
      fetch("/api/streak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: today }),
      });
    let res: Response;
    try {
      res = await postStreak();
      if (res.status === 401) {
        // Streaks get logged right after the midnight rollover — the moment a
        // long-open tab's access token is most likely stale or mid-rotation
        // (the rollover itself fires a burst of authed calls). Let supabase
        // settle a fresh session and retry once before showing the scary
        // "sign in again" message for what is usually a transient blip.
        await createClient().auth.getSession();
        res = await postStreak();
      }
    } catch (err) {
      console.error("Failed to log activity (network):", err);
      rollback();
      setLogError("Network error — check your connection and try again.");
      return;
    }

    if (!res.ok) {
      let message = "Couldn't log your activity. Try again in a moment.";
      try {
        const body = await res.json();
        if (body?.error && typeof body.error === "string") message = body.error;
      } catch {}
      if (res.status === 401) message = "Your session expired — refresh and sign in again.";
      console.error("Failed to log activity:", res.status, message);
      rollback();
      setLogError(message);
      return;
    }

    setLogging(false);

    // Drop the navbar "unlogged activity" dot without a reload. Fired only
    // after the write lands — the navbar re-checks against the server, so
    // announcing it optimistically would just race the write and get the
    // pre-write answer back.
    window.dispatchEvent(new Event("streak-updated"));

    // Mark streak warning notifications as read and refresh the bell
    fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "streak_warning" }),
    }).then((res) => {
      if (res.ok) {
        window.dispatchEvent(new Event("notifications-updated"));
      }
    }).catch(() => {});
  };

  const handleAddProject = async () => {
    if (!user || addingProject || !projectForm.title || !projectForm.description) return;
    setProjectError("");

    if (projectForm.description.length < 10) {
      setProjectError("Description must be at least 10 characters.");
      return;
    }
    if (projectForm.description.length > 500) {
      setProjectError("Description must be 500 characters or less.");
      return;
    }
    const liveUrlTrim = projectForm.live_url.trim();
    const githubUrlTrim = projectForm.github_url.trim();
    if (!liveUrlTrim && !githubUrlTrim) {
      setProjectError("Add a live URL or a GitHub repo — at least one is required so clients can verify your work.");
      return;
    }
    // Validate + canonicalize URLs. Persist normalized forms so the DB
    // never carries bare-domain values that would render as relative paths.
    let normalizedLiveUrl: string | null = null;
    if (liveUrlTrim) {
      normalizedLiveUrl = normalizeExternalUrl(liveUrlTrim);
      if (!normalizedLiveUrl || !normalizedLiveUrl.startsWith("https://")) {
        setProjectError("Live URL must be a valid URL (e.g. https://example.com)");
        return;
      }
    }
    let normalizedGithubUrl: string | null = null;
    if (githubUrlTrim) {
      normalizedGithubUrl = normalizeRepoUrl(githubUrlTrim);
      if (!normalizedGithubUrl) {
        setProjectError("GitHub URL must be a valid GitHub repo (e.g. https://github.com/username/repo)");
        return;
      }
    }

    setAddingProject(true);
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;

    const { data: insertedProject, error } = await sb.from("projects").insert({
      user_id: user.id,
      title: projectForm.title,
      description: projectForm.description,
      tech_stack: projectForm.tech_stack ? projectForm.tech_stack.split(",").map((t: string) => t.trim()).filter(Boolean) : [],
      live_url: normalizedLiveUrl,
      github_url: normalizedGithubUrl,
      build_time: projectForm.build_time || null,
      tags: projectForm.tags ? projectForm.tags.split(",").map((t: string) => t.trim()).filter(Boolean) : [],
    }).select("id").single();

    if (error) {
      console.error("Failed to add project:", error);
      setAddingProject(false);
      return;
    }

    // Upload project image if selected. The file has already been processed
    // to a 16:9 JPEG (see validateAndSetImage), so no y/z crop params are
    // needed — parseImageCrop falls back to center/1.0 for new URLs.
    if (projectImageFile && insertedProject?.id) {
      const filePath = `${user.id}/${insertedProject.id}/image.jpg`;
      const { error: uploadError } = await sb.storage.from("project-images").upload(filePath, projectImageFile, { upsert: true, contentType: "image/jpeg" });
      if (!uploadError) {
        const { data: { publicUrl } } = sb.storage.from("project-images").getPublicUrl(filePath);
        await sb.from("projects").update({ image_url: `${publicUrl}?t=${Date.now()}` }).eq("id", insertedProject.id);
      }
    }

    // Auto-log streak when shipping a project
    const nowLocal = new Date();
    const today = `${nowLocal.getFullYear()}-${String(nowLocal.getMonth() + 1).padStart(2, "0")}-${String(nowLocal.getDate()).padStart(2, "0")}`;
    await sb.from("streak_logs").upsert({ user_id: user.id, activity_date: today }, { onConflict: "user_id,activity_date" });

    // DB trigger auto-updates vibe_score — reload to get fresh data
    await reloadUser();
    setProjectForm({ title: "", description: "", tech_stack: "", live_url: "", github_url: "", build_time: "", tags: "" });
    setProjectImageFile(null);
    setPreviewBlobUrl(null);
    setImageError(null);
    setShowProjectForm(false);
    setAddingProject(false);

    // Auto-verify if project has a GitHub URL
    if (projectForm.github_url && insertedProject?.id) {
      verifyProject(insertedProject.id);
    }
  };

  const handleStartEdit = (project: import("@/lib/types/database").Project) => {
    setEditingProjectId(project.id);
    setEditingOriginalGithubUrl(project.github_url || "");
    setProjectForm({
      title: project.title,
      description: project.description || "",
      tech_stack: project.tech_stack?.join(", ") || "",
      live_url: project.live_url || "",
      github_url: project.github_url || "",
      build_time: project.build_time || "",
      tags: project.tags?.join(", ") || "",
    });
    // Show the existing image as the preview. We deliberately don't surface
    // any reposition/zoom UI any more — new uploads are processed to 16:9
    // before upload, so the controls became obsolete. Legacy images keep
    // their existing y/z params on the saved image_url and continue to
    // render correctly via parseImageCrop on the public side.
    setProjectImageFile(null);
    setPreviewBlobUrl(null);
    setProjectImagePreview(project.image_url || null);
    setImageError(null);
    setShowProjectForm(true);
  };

  const handleSaveEdit = async () => {
    if (!user || !editingProjectId || savingEdit || !projectForm.title || !projectForm.description) return;
    setProjectError("");

    if (projectForm.description.length < 10) {
      setProjectError("Description must be at least 10 characters.");
      return;
    }
    if (projectForm.description.length > 500) {
      setProjectError("Description must be 500 characters or less.");
      return;
    }
    const liveUrlTrim = projectForm.live_url.trim();
    const githubUrlTrim = projectForm.github_url.trim();
    if (!liveUrlTrim && !githubUrlTrim) {
      setProjectError("Add a live URL or a GitHub repo — at least one is required so clients can verify your work.");
      return;
    }
    let normalizedLiveUrl: string | null = null;
    if (liveUrlTrim) {
      normalizedLiveUrl = normalizeExternalUrl(liveUrlTrim);
      if (!normalizedLiveUrl || !normalizedLiveUrl.startsWith("https://")) {
        setProjectError("Live URL must be a valid URL (e.g. https://example.com)");
        return;
      }
    }
    let normalizedGithubUrl: string | null = null;
    if (githubUrlTrim) {
      normalizedGithubUrl = normalizeRepoUrl(githubUrlTrim);
      if (!normalizedGithubUrl) {
        setProjectError("GitHub URL must be a valid GitHub repo (e.g. https://github.com/username/repo)");
        return;
      }
    }

    setSavingEdit(true);
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;

    const { error } = await sb.from("projects").update({
      title: projectForm.title,
      description: projectForm.description,
      tech_stack: projectForm.tech_stack ? projectForm.tech_stack.split(",").map((t: string) => t.trim()).filter(Boolean) : [],
      live_url: normalizedLiveUrl,
      github_url: normalizedGithubUrl,
      build_time: projectForm.build_time || null,
      tags: projectForm.tags ? projectForm.tags.split(",").map((t: string) => t.trim()).filter(Boolean) : [],
    }).eq("id", editingProjectId);

    if (error) {
      console.error("Failed to update project:", error);
      setSavingEdit(false);
      return;
    }

    // Upload project image if a new file was selected. New uploads are
    // pre-processed to 16:9 JPEG so no y/z params are written; legacy
    // image_url values that already have y/z params are left untouched
    // when no new file is chosen.
    if (projectImageFile && user && editingProjectId) {
      const filePath = `${user.id}/${editingProjectId}/image.jpg`;
      const { error: uploadError } = await sb.storage.from("project-images").upload(filePath, projectImageFile, { upsert: true, contentType: "image/jpeg" });
      if (!uploadError) {
        const { data: { publicUrl } } = sb.storage.from("project-images").getPublicUrl(filePath);
        await sb.from("projects").update({ image_url: `${publicUrl}?t=${Date.now()}` }).eq("id", editingProjectId);
      }
    }

    await reloadUser();

    // Auto-verify if GitHub URL changed
    const githubUrlChanged = projectForm.github_url !== editingOriginalGithubUrl;
    const savedEditingId = editingProjectId;

    setProjectForm({ title: "", description: "", tech_stack: "", live_url: "", github_url: "", build_time: "", tags: "" });
    setProjectImageFile(null);
    setPreviewBlobUrl(null);
    setImageError(null);
    setShowProjectForm(false);
    setEditingProjectId(null);
    setEditingOriginalGithubUrl("");
    setSavingEdit(false);

    if (githubUrlChanged && projectForm.github_url && savedEditingId) {
      verifyProject(savedEditingId);
    }
  };

  if (loading) {
    // Mirrors dashboard/loading.tsx so the route-segment skeleton and the
    // client-state skeleton paint the same shape — no layout jump when the
    // page hydrates with `loading=true` after the route loader unmounts.
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
        <div className="mb-8">
          <div className="skeleton h-9 w-48 mb-3" />
          <div className="skeleton h-5 w-72" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
          <div className="flex flex-col gap-4">
            <div className="skeleton h-40 w-full rounded-xl" />
            <div className="skeleton h-24 w-full rounded-xl" />
          </div>
          <div className="flex flex-col gap-4">
            <div className="skeleton h-20 w-full rounded-xl" />
            <div className="skeleton h-64 w-full rounded-xl" />
            <div className="skeleton h-48 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12 text-center">
        <h1 className="text-3xl font-extrabold uppercase text-[var(--foreground)] mb-4">Dashboard</h1>
        <p className="text-[var(--text-secondary)] font-medium">Please sign in to view your dashboard.</p>
      </div>
    );
  }

  // Inbox "new" badge: derived from the fetched list once available, the
  // initial head-count seed before that.
  const newHireCount = inboxLoaded
    ? hireRequests.filter((r) => r.status === "new").length
    : newHireSeed;

  // How many of this builder's projects have the VibeTalent badge in their
  // README, per the last quality scan.
  const badgedProjectCount = (user.projects ?? []).filter(
    (p) => p.quality_metrics?.has_vibetalent_badge
  ).length;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
      <h1 className="text-3xl font-extrabold uppercase text-[var(--foreground)] mb-6">Dashboard</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-8">
        <button
          onClick={() => setActiveTab("overview")}
          className="px-5 py-2.5 text-sm font-extrabold uppercase tracking-wide transition-all"
          style={{
            backgroundColor: activeTab === "overview" ? "var(--accent)" : "var(--bg-surface)",
            color: activeTab === "overview" ? "var(--text-on-inverted)" : "var(--foreground)",
            border: "2px solid var(--border-hard)",
            boxShadow: activeTab === "overview" ? "none" : "4px 4px 0 var(--border-hard)",
          }}
        >
          Overview
        </button>
        <button
          onClick={() => { setActiveTab("inbox"); if (user) loadInbox(); }}
          className="px-5 py-2.5 text-sm font-extrabold uppercase tracking-wide transition-all flex items-center gap-2"
          style={{
            backgroundColor: activeTab === "inbox" ? "var(--accent)" : "var(--bg-surface)",
            color: activeTab === "inbox" ? "var(--text-on-inverted)" : "var(--foreground)",
            border: "2px solid var(--border-hard)",
            boxShadow: activeTab === "inbox" ? "none" : "4px 4px 0 var(--border-hard)",
          }}
        >
          <Inbox size={16} />
          Inbox
          {newHireCount > 0 && (
            <span
              className="ml-1 px-2 py-0.5 text-xs font-extrabold"
              style={{
                backgroundColor: "var(--accent)",
                color: "var(--text-on-inverted)",
                border: "2px solid var(--border-hard)",
              }}
            >
              {newHireCount}
            </span>
          )}
        </button>
      </div>

      {activeTab === "overview" && (
      <>
      {/* First Streak Nudge — shown to new users who haven't logged any activity yet */}
      {user.streak === 0 && user.longest_streak === 0 && !todayLogged && (
        <div
          className="mb-8 p-6 relative overflow-hidden"
          style={{
            backgroundColor: "var(--accent)",
            border: "2px solid var(--border-hard)",
            boxShadow: "var(--shadow-brutal)",
          }}
        >
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div
                className="w-14 h-14 flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: "var(--background)",
                  border: "2px solid var(--border-hard)",
                }}
              >
                <Flame size={28} className="text-[var(--accent)]" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold uppercase text-white">
                  Start Your Streak Today!
                </h2>
                <p className="text-sm font-medium text-white/80 mt-0.5">
                  Log your first day of coding to begin building your reputation. Streaks are the #1 signal clients look for.
                </p>
              </div>
            </div>
            <button
              onClick={handleLogActivity}
              disabled={logging}
              className="btn-brutal text-sm shrink-0"
              style={{
                backgroundColor: "var(--background)",
                color: "var(--foreground)",
                fontSize: "16px",
                padding: "12px 24px",
              }}
            >
              {logging ? "Logging..." : "Log Day 1"}
              {!logging && <Flame size={18} className="ml-2 text-[var(--accent)]" />}
            </button>
          </div>
        </div>
      )}

      {/* 2-Column Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

      {/* Left Column — Main Content */}
      <div className="lg:col-span-2 space-y-6">

      {/* Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div
          className="p-5"
          style={{
            backgroundColor: "var(--bg-surface)",
            border: "2px solid var(--border-hard)",
            boxShadow: "var(--shadow-brutal-sm)",
          }}
        >
          <Flame size={20} className="text-[var(--accent)] mb-2" />
          <div className="text-2xl font-extrabold font-mono text-[var(--foreground)]">{user.streak}</div>
          <div className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mt-1">Current Streak</div>
        </div>
        <div
          className="p-5"
          style={{
            backgroundColor: "var(--bg-surface)",
            border: "2px solid var(--border-hard)",
            boxShadow: "var(--shadow-brutal-sm)",
          }}
        >
          <Trophy size={20} className="text-[var(--status-warning-text)] mb-2" />
          <div className="text-2xl font-extrabold font-mono text-[var(--foreground)]">{user.longest_streak}</div>
          <div className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mt-1">Longest Streak</div>
        </div>
        <div
          className="p-5"
          style={{
            backgroundColor: "var(--bg-surface)",
            border: "2px solid var(--border-hard)",
            boxShadow: "var(--shadow-brutal-sm)",
          }}
        >
          <Zap size={20} className="text-[var(--accent)] fill-[var(--accent)] mb-2" />
          <div className="text-2xl font-extrabold font-mono text-[var(--accent)]">{user.vibe_score}</div>
          <div className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mt-1">Vibe Score</div>
        </div>
        <div
          className="p-5"
          style={{
            backgroundColor: "var(--bg-surface)",
            border: "2px solid var(--border-hard)",
            boxShadow: "var(--shadow-brutal-sm)",
          }}
        >
          <Code2 size={20} className="text-[var(--accent)] mb-2" />
          <div className="text-2xl font-extrabold font-mono text-[var(--foreground)]">{(user.projects ?? []).length}</div>
          <div className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mt-1">Projects</div>
        </div>
      </div>

      {/* Streak Milestone & Motivation */}
      <StreakMilestone streak={user.streak} />

      {/* Activity Heatmap */}
      <div
        className="p-6"
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "2px solid var(--border-hard)",
          boxShadow: "var(--shadow-brutal)",
        }}
      >
        <h2 className="text-lg font-extrabold uppercase text-[var(--foreground)] mb-4">Your Activity</h2>
        <ActivityHeatmap data={heatmapData} totalOverride={ghTotal > 0 ? ghTotal : undefined} />
      </div>

      {/* Your Projects */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-extrabold uppercase text-[var(--foreground)]">Your Projects</h2>
          <button
            onClick={() => {
              if (showProjectForm) {
                setShowProjectForm(false);
                setEditingProjectId(null);
                setEditingOriginalGithubUrl("");
                setProjectForm({ title: "", description: "", tech_stack: "", live_url: "", github_url: "", build_time: "", tags: "" });
                setProjectError("");
                setProjectImageFile(null);
                setPreviewBlobUrl(null);
                setImageError(null);
              } else {
                setShowProjectForm(true);
              }
            }}
            className="btn-brutal btn-brutal-secondary text-sm flex items-center gap-2 py-2 px-4"
          >
            {showProjectForm ? <X size={16} /> : <Plus size={16} />}
            {showProjectForm ? "Cancel" : "Add Project"}
          </button>
        </div>

        {/* Verification Guide */}
        {showVerifyGuide && (
          <div
            className="mb-4 p-4 relative"
            style={{ backgroundColor: "var(--bg-surface)", border: "2px solid var(--border-hard)" }}
          >
            <button
              onClick={() => setShowVerifyGuide(false)}
              className="absolute top-3 right-3 text-[var(--text-muted-soft)] hover:text-[var(--foreground)] transition-colors"
              title="Dismiss"
            >
              <X size={14} />
            </button>
            <h3 className="text-sm font-extrabold uppercase text-[var(--foreground)] flex items-center gap-2 mb-2">
              <ShieldCheck size={16} className="text-green-600" />
              How to Verify Your Projects
            </h3>
            <p className="text-xs text-[var(--text-secondary)] font-medium leading-relaxed">
              Verified projects show a green badge, proving you own the code. There are two ways to verify:
            </p>
            <ol className="text-xs text-[var(--text-secondary)] font-medium mt-2 space-y-1.5 list-decimal list-inside leading-relaxed">
              <li>
                <strong className="text-[var(--foreground)]">Owner Match (automatic):</strong> If the GitHub repo URL belongs to your GitHub account (the one you signed in with), it verifies instantly.
              </li>
              <li>
                <strong className="text-[var(--foreground)]">Verification File (for collaborators):</strong> Add a file named <code className="bg-[var(--bg-surface)] px-1.5 py-0.5 border border-[var(--border-subtle)] font-mono text-[10px]">.vibetalent</code> to the root of the repo containing your GitHub username. Then click the <strong>Verify</strong> button on the project card below.
              </li>
            </ol>
          </div>
        )}

        {showProjectForm && (
          <div
            className="p-5 mb-4"
            style={{
              backgroundColor: "var(--bg-surface)",
              border: "2px solid var(--border-hard)",
              boxShadow: "var(--shadow-brutal-sm)",
            }}
          >
            <h3 className="text-sm font-extrabold uppercase text-[var(--foreground)] mb-3">{editingProjectId ? "Edit Project" : "New Project"}</h3>
            {projectError && (
              <div className="p-3 mb-3 text-sm font-bold text-[var(--status-error-text)]" style={{ backgroundColor: "var(--status-error-border)", border: "2px solid var(--border-hard)" }}>
                {projectError}
              </div>
            )}
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Project name"
                value={projectForm.title}
                onChange={(e) => setProjectForm({ ...projectForm, title: e.target.value })}
                className="input-brutal"
              />
              <div>
                <textarea
                  placeholder="Description"
                  value={projectForm.description}
                  onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                  rows={2}
                  maxLength={500}
                  className="input-brutal resize-none"
                />
                <div className="mt-1 text-right text-xs font-bold text-[var(--text-muted)]">
                  {projectForm.description.length}/500
                </div>
              </div>
              <input
                type="text"
                placeholder="Tech stack (comma separated)"
                value={projectForm.tech_stack}
                onChange={(e) => setProjectForm({ ...projectForm, tech_stack: e.target.value })}
                className="input-brutal"
              />
              <p className="text-xs font-semibold text-[var(--text-secondary)]">
                Add a live URL or a GitHub repo — at least one is required.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Live URL (https://…)"
                  value={projectForm.live_url}
                  onChange={(e) => setProjectForm({ ...projectForm, live_url: e.target.value })}
                  className="input-brutal"
                />
                <input
                  type="text"
                  placeholder="GitHub URL (https://github.com/…)"
                  value={projectForm.github_url}
                  onChange={(e) => setProjectForm({ ...projectForm, github_url: e.target.value })}
                  className="input-brutal"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Build time (e.g., 2 days)"
                  value={projectForm.build_time}
                  onChange={(e) => setProjectForm({ ...projectForm, build_time: e.target.value })}
                  className="input-brutal"
                />
                <input
                  type="text"
                  placeholder="Tags (comma separated)"
                  value={projectForm.tags}
                  onChange={(e) => setProjectForm({ ...projectForm, tags: e.target.value })}
                  className="input-brutal"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-1.5 block">Project Screenshot</label>
                {projectImagePreview ? (
                  <div>
                    <div
                      className="relative w-full border-2 border-[var(--border-hard)] overflow-hidden bg-[var(--bg-surface-light)]"
                      style={{ aspectRatio: "16 / 9" }}
                    >
                      {(() => {
                        // For freshly-processed uploads (blob: URL) the image
                        // is already 16:9 — show with object-cover at default
                        // position. For legacy edits we get back a stored
                        // public URL that may carry y/z params from the old
                        // crop/zoom UI; replay those so the preview matches
                        // what visitors see on the live site.
                        const isBlobPreview =
                          projectImagePreview.startsWith("blob:") ||
                          projectImageFile !== null;
                        let objectPosition = "center";
                        let transform = "none";
                        if (!isBlobPreview) {
                          try {
                            const u = new URL(projectImagePreview);
                            const y = u.searchParams.get("y");
                            const z = u.searchParams.get("z");
                            if (y) objectPosition = `center ${y}%`;
                            if (z) transform = `scale(${parseFloat(z) || 1})`;
                          } catch {
                            /* fall through to defaults */
                          }
                        }
                        return (
                          <Image
                            src={projectImagePreview}
                            alt="Preview"
                            fill
                            className="object-cover pointer-events-none"
                            style={{ objectPosition, transform }}
                            unoptimized={isBlobPreview}
                            draggable={false}
                          />
                        );
                      })()}
                      <div className="absolute top-2 right-2 flex gap-2">
                        <button type="button" onClick={(e) => { e.stopPropagation(); projectImageInputRef.current?.click(); }} className="w-7 h-7 bg-black/60 text-white rounded-full flex items-center justify-center text-xs hover:bg-black/80 transition-colors" title="Change image">
                          <Camera size={14} />
                        </button>
                        <button type="button" onClick={(e) => { e.stopPropagation(); setProjectImageFile(null); setPreviewBlobUrl(null); setProjectImagePreview(null); setImageError(null); }} className="w-7 h-7 bg-black/60 text-white rounded-full flex items-center justify-center text-xs hover:bg-black/80 transition-colors" title="Remove image">&times;</button>
                      </div>
                      {imageProcessing && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-[10px] font-bold uppercase tracking-wider text-white">
                          Processing…
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className={`w-full border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] ${imageDragging ? "border-[var(--accent)] bg-[rgba(255,58,0,0.06)]" : "border-[var(--border-hard)] hover:border-[var(--accent)]"}`}
                    style={{ aspectRatio: "16 / 9" }}
                    onClick={() => projectImageInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setImageDragging(true); }}
                    onDragLeave={() => setImageDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setImageDragging(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) void validateAndSetImage(file);
                    }}
                    aria-label="Upload project screenshot"
                    aria-busy={imageProcessing}
                  >
                    {imageProcessing ? (
                      <span className="text-xs font-bold uppercase text-[var(--text-muted)]">Processing…</span>
                    ) : (
                      <>
                        <Camera size={20} className="text-[var(--text-muted)]" />
                        <span className="text-xs font-bold uppercase text-[var(--text-muted)]">Drag, click, or paste an image</span>
                        <span className="text-[10px] text-[var(--text-muted-soft)]">Auto-fitted to 16:9. Max 20MB. JPG, PNG, WebP, GIF.</span>
                      </>
                    )}
                  </button>
                )}
                {imageError && (
                  <p className="text-[10px] font-bold text-red-600 mt-1.5" role="alert">{imageError}</p>
                )}
                <input ref={projectImageInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleProjectImageSelect} className="hidden" />
              </div>
              <button
                onClick={editingProjectId ? handleSaveEdit : handleAddProject}
                disabled={(editingProjectId ? savingEdit : addingProject) || !projectForm.title || !projectForm.description}
                className="btn-brutal btn-brutal-primary text-sm flex items-center gap-2 disabled:opacity-50"
              >
                {editingProjectId ? <Save size={16} /> : <Plus size={16} />}
                {editingProjectId
                  ? (savingEdit ? "Saving..." : "Save Changes")
                  : (addingProject ? "Adding..." : "Add Project")}
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
          {(user.projects ?? []).map((project) => (
            <div key={project.id}>
              <ProjectCard
                project={project}
                onEdit={handleStartEdit}
                verified={!!project.verified}
                onVerify={verifyProject}
              />
              {verifyingProjectId === project.id && (
                <div className="mt-1 px-4 py-1.5 text-[10px] font-bold text-[var(--text-muted)] uppercase">
                  Verifying...
                </div>
              )}
              {verifyMessage && verifyMessage.projectId === project.id && (
                <div className={`mt-1 px-4 py-1.5 text-[10px] font-bold uppercase ${verifyMessage.success ? "text-green-600" : "text-orange-600"}`}>
                  {verifyMessage.text}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      </div>{/* End Left Column */}

      {/* Right Column — Sidebar */}
      <div className="lg:col-span-1 space-y-6">

      {/* Log Activity */}
      <div
        className="p-6"
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "2px solid var(--border-hard)",
          boxShadow: "var(--shadow-brutal)",
        }}
      >
        <div className="flex flex-col gap-3">
          <div>
            <h2 className="text-base font-extrabold uppercase flex items-center gap-2 text-[var(--foreground)]">
              <Flame size={18} className="text-[var(--accent)]" />
              {todayLogged ? "Logged Today" : "Log Activity"}
            </h2>
            <p className="text-xs text-[var(--text-secondary)] font-medium mt-1">
              {todayLogged
                ? "Come back tomorrow!"
                : "Keep your streak alive"}
            </p>
          </div>
          {todayLogged ? (
            <div
              className="text-center px-3 py-2"
              style={{
                backgroundColor: "var(--status-success-bg)",
                border: "2px solid var(--border-hard)",
              }}
            >
              <div className="flex items-center justify-center gap-2 mb-1">
                <Check size={14} className="text-[var(--status-success-text)]" />
                <span className="text-xs font-bold uppercase text-[var(--status-success-text)]">Done for today</span>
              </div>
              <div className="flex items-center justify-center gap-1.5">
                <Clock size={12} className="text-[var(--status-success-text)]" />
                <span className="text-sm font-extrabold font-mono text-[var(--status-success-text)]">
                  <MidnightCountdown onMidnight={handleMidnight} />
                </span>
              </div>
            </div>
          ) : (
            <>
              <button
                onClick={handleLogActivity}
                disabled={logging}
                className="btn-brutal text-sm w-full"
                style={{
                  backgroundColor: "var(--accent)",
                  color: "var(--text-on-inverted)",
                }}
              >
                {logging ? "Logging..." : "Log Activity"}
              </button>
              {logError && (
                <p
                  role="alert"
                  className="text-xs font-semibold mt-1"
                  style={{ color: "var(--status-error-text, #dc2626)" }}
                >
                  {logError}
                </p>
              )}
            </>
          )}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <StreakCounter streak={user.streak} size="lg" />
          <span className="text-sm font-bold text-[var(--text-secondary)] uppercase">day streak</span>
        </div>
        <div className="mt-2">
          <BadgeDisplay level={user.badge_level} />
        </div>
        {/* Streak Freeze Status */}
        <div className="mt-3 flex items-center gap-2">
          <ShieldCheck size={16} className="text-cyan-600" />
          <span className="text-sm font-bold text-[var(--text-secondary)]">
            {user.streak_freezes_remaining ?? 2} / 2 Freezes Available
          </span>
          {(user.streak_freezes_used ?? 0) > 0 && (
            <span className="text-xs font-medium text-zinc-400">
              ({user.streak_freezes_used} used this month)
            </span>
          )}
        </div>
        {/* GitHub Sync */}
        {user.social_links?.github && (
          <div className="mt-4 pt-4 border-t-2 border-zinc-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code2 size={16} className="text-[var(--text-secondary)]" />
                <span className="text-sm font-bold text-[var(--text-secondary)]">GitHub Auto-Sync</span>
              </div>
              <button onClick={handleGithubSync} disabled={syncingGithub} className="btn-brutal btn-brutal-secondary text-xs py-1.5 px-3">
                {syncingGithub ? "Syncing..." : "Sync Now"}
              </button>
            </div>
            {githubSyncResult && (
              <p className={`text-xs mt-2 font-medium ${githubSyncResult.startsWith("\u2713") ? "text-emerald-700" : githubSyncResult.startsWith("\u26A0") ? "text-amber-700" : "text-zinc-500"}`}>
                {githubSyncResult}
              </p>
            )}
            {lastSyncLabel && !githubSyncResult && (
              <p className="text-xs mt-2 font-medium text-zinc-400">
                Last synced {lastSyncLabel}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Profile Views */}
      <ProfileViewsWidget />

      {/* Embeddable Badge for GitHub */}
      <div
        className="p-5"
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "2px solid var(--border-hard)",
          boxShadow: "var(--shadow-brutal)",
        }}
      >
        <h2 className="text-base font-extrabold uppercase flex items-center gap-2 text-[var(--foreground)] mb-3">
          <ExternalLink size={16} className="text-[var(--accent)]" />
          Embeddable Badge
        </h2>

        {/* Nudge / confirmation. `has_vibetalent_badge` is only populated on
            projects analyzed since badge detection shipped, so "not found yet"
            is phrased as an invitation rather than an accusation — an older
            project genuinely may have the badge and not know it until its next
            weekly rescore. */}
        {badgedProjectCount > 0 ? (
          <div
            className="mb-3 px-3 py-2 flex items-center gap-2"
            style={{ backgroundColor: "var(--status-success-bg)", border: "2px solid var(--border-hard)" }}
          >
            <ShieldCheck size={14} className="text-[var(--status-success-text)] shrink-0" />
            <span className="text-xs font-bold text-[var(--status-success-text)]">
              Badge found in {badgedProjectCount} {badgedProjectCount === 1 ? "repo" : "repos"} — nice.
            </span>
          </div>
        ) : (
          <p className="mb-3 text-xs font-medium text-[var(--text-secondary)] leading-relaxed">
            Drop this in a repo README to show your streak and score where other
            developers actually look. We&apos;ll spot it on the next scan and add a
            <span className="font-extrabold text-[var(--accent)]"> Badge Holder </span>
            chip to your projects.
          </p>
        )}

        <div className="flex items-center gap-4 p-3 bg-zinc-50 border-2 border-zinc-200 mb-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/badge/${user.username}`}
            alt={`${user.username}'s VibeTalent badge`}
            height={28}
          />
        </div>

        <div className="flex flex-col gap-2">
          {(() => {
            const encodedName = encodeURIComponent(user.username);
            const badgeImgUrl = `${siteUrl}/api/badge/${encodedName}`;
            const profileUrl = `${siteUrl}/profile/${encodedName}`;
            return (
              <>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`[![VibeTalent](${badgeImgUrl})](${profileUrl})`);
                    setBadgeCopied("md");
                    setTimeout(() => setBadgeCopied(null), 2000);
                  }}
                  className="btn-brutal flex items-center justify-center gap-1.5 text-xs py-2"
                  style={{ backgroundColor: badgeCopied === "md" ? "var(--status-success-bg)" : "var(--bg-surface)" }}
                >
                  {badgeCopied === "md" ? "Copied!" : "Copy Markdown"}
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`<a href="${profileUrl}"><img src="${badgeImgUrl}" alt="VibeTalent Badge" /></a>`);
                    setBadgeCopied("html");
                    setTimeout(() => setBadgeCopied(null), 2000);
                  }}
                  className="btn-brutal flex items-center justify-center gap-1.5 text-xs py-2"
                  style={{ backgroundColor: badgeCopied === "html" ? "var(--status-success-bg)" : "var(--bg-surface)" }}
                >
                  {badgeCopied === "html" ? "Copied!" : "Copy HTML"}
                </button>
              </>
            );
          })()}
        </div>
      </div>

      </div>{/* End Right Column */}

      </div>{/* End 2-Column Grid */}
      </>
      )}

      {activeTab === "inbox" && (
        <div>
          <h2 className="text-lg font-extrabold uppercase text-[var(--foreground)] mb-4 flex items-center gap-2">
            <Mail size={20} className="text-[var(--accent)]" />
            Hire Requests
          </h2>

          {loadingInbox ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-32" />
              ))}
            </div>
          ) : inboxError ? (
            <div
              className="p-8 text-center"
              style={{
                backgroundColor: "var(--bg-surface)",
                border: "2px solid var(--border-hard)",
                boxShadow: "var(--shadow-brutal)",
              }}
              role="alert"
            >
              <Inbox size={40} className="mx-auto text-[var(--text-muted-soft)] mb-3" />
              <h3 className="text-base font-extrabold uppercase text-[var(--foreground)]">
                Couldn&apos;t load your inbox
              </h3>
              <p className="text-sm text-[var(--text-secondary)] font-medium mt-2">{inboxError}</p>
              <button onClick={loadInbox} className="btn-brutal btn-brutal-secondary text-sm mt-4">
                Retry
              </button>
            </div>
          ) : hireRequests.length === 0 ? (
            <div
              className="p-12 text-center"
              style={{
                backgroundColor: "var(--bg-surface)",
                border: "2px solid var(--border-hard)",
                boxShadow: "var(--shadow-brutal)",
              }}
            >
              <Inbox size={48} className="mx-auto text-[var(--text-muted-soft)] mb-4" />
              <h3 className="text-lg font-extrabold uppercase text-[var(--foreground)]">No hire requests yet</h3>
              <p className="text-sm text-[var(--text-secondary)] font-medium mt-2">
                When someone wants to hire you, their requests will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {hireRequests.map((request) => (
                <div
                  key={request.id}
                  className="p-5"
                  style={{
                    backgroundColor: request.status === "new" ? "var(--status-warning-bg)" : "var(--bg-surface)",
                    border: "2px solid var(--border-hard)",
                    boxShadow: "var(--shadow-brutal-sm)",
                  }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-base font-extrabold text-[var(--foreground)]">
                          {senderProfiles[request.id]?.username ? (
                            <Link
                              href={`/profile/${encodeURIComponent(senderProfiles[request.id].username)}`}
                              className="hover:underline"
                              style={{ color: "var(--accent)" }}
                              title={`View @${senderProfiles[request.id].username}'s profile`}
                            >
                              {request.sender_name}
                            </Link>
                          ) : (
                            request.sender_name
                          )}
                        </h3>
                        <span
                          className="px-2.5 py-0.5 text-xs font-extrabold uppercase"
                          style={{
                            backgroundColor:
                              request.status === "new"
                                ? "var(--accent)"
                                : request.status === "read"
                                ? "var(--border-subtle)"
                                : "var(--status-success-bg)",
                            color:
                              request.status === "new"
                                ? "var(--bg-surface)"
                                : request.status === "read"
                                ? "var(--text-secondary)"
                                : "var(--status-success-text)",
                            border: "2px solid var(--border-hard)",
                          }}
                        >
                          {request.status}
                        </span>
                      </div>
                      <p className="text-sm text-[var(--text-secondary)] font-medium mt-0.5">
                        {request.sender_email}
                      </p>

                      {request.budget && (
                        <div className="flex items-center gap-1.5 mt-2">
                          <DollarSign size={14} className="text-[var(--accent)]" />
                          <span className="text-sm font-bold text-[var(--foreground)]">{request.budget}</span>
                        </div>
                      )}

                      <p className="text-sm text-[var(--text-tertiary)] mt-3 whitespace-pre-wrap">
                        {request.message}
                      </p>

                      <p className="text-xs text-[var(--text-muted-soft)] font-bold uppercase mt-3">
                        {new Date(request.created_at).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>

                    <div className="flex gap-2 shrink-0">
                      {request.status === "new" && (
                        <button
                          onClick={() => handleMarkAsRead(request.id)}
                          className="btn-brutal btn-brutal-secondary text-xs py-2 px-3 flex items-center gap-1.5"
                        >
                          <MailOpen size={14} />
                          Mark as Read
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (request.status === "new") handleMarkAsRead(request.id);
                          handleOpenChat(request.id);
                        }}
                        className="btn-brutal text-xs py-2 px-3 flex items-center gap-1.5"
                        style={{
                          backgroundColor: replyingTo === request.id ? "var(--bg-inverted)" : "var(--accent)",
                          color: "var(--text-on-inverted)",
                        }}
                      >
                        <MessageCircle size={14} />
                        {replyingTo === request.id ? "Close Chat" : "Chat"}
                      </button>
                      <a
                        href={`/hire/chat/${request.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-brutal btn-brutal-secondary text-xs py-2 px-3 flex items-center gap-1.5"
                        title="Open client chat page"
                      >
                        <ExternalLink size={14} />
                      </a>
                      {confirmingDelete === request.id ? (
                        <div className="flex gap-1">
                          <button
                            onClick={() => { handleDeleteRequest(request.id); setConfirmingDelete(null); }}
                            className="btn-brutal text-xs py-2 px-3"
                            style={{ backgroundColor: "#DC2626", color: "#fff" }}
                          >
                            Yes, Delete
                          </button>
                          <button
                            onClick={() => setConfirmingDelete(null)}
                            className="btn-brutal btn-brutal-secondary text-xs py-2 px-3"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmingDelete(request.id)}
                          className="btn-brutal text-xs py-2 px-3 flex items-center gap-1.5"
                          style={{ backgroundColor: "var(--status-error-border)", color: "var(--status-error-text)" }}
                          title="Delete request"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Chat Thread */}
                  {replyingTo === request.id && (
                    <div
                      className="mt-4"
                      style={{
                        border: "2px solid var(--border-hard)",
                      }}
                    >
                      {/* Messages area */}
                      <div
                        style={{
                          backgroundColor: "var(--bg-surface-light)",
                          maxHeight: "400px",
                          overflowY: "auto",
                        }}
                      >
                        <div className="p-4 space-y-3">
                          {loadingChat === request.id ? (
                            <div className="text-center py-8">
                              <p className="text-sm text-[var(--text-muted)] font-medium">Loading messages...</p>
                            </div>
                          ) : (
                            <>
                              {/* Original message as first "message" */}
                              <div className="flex justify-start">
                                <div className="max-w-[80%]">
                                  <div className="flex items-center gap-2 mb-1">
                                    <User size={12} className="text-[var(--text-muted)]" />
                                    <span className="text-xs font-bold uppercase text-[var(--text-muted)]">
                                      {request.sender_name}
                                    </span>
                                  </div>
                                  <div
                                    className="p-3"
                                    style={{
                                      backgroundColor: "var(--bg-surface)",
                                      border: "2px solid var(--border-hard)",
                                      boxShadow: "var(--shadow-brutal-xs)",
                                    }}
                                  >
                                    <p className="text-sm text-[var(--text-tertiary)] whitespace-pre-wrap">
                                      {request.message}
                                    </p>
                                  </div>
                                  <p className="text-xs text-[var(--text-muted-soft)] mt-1">
                                    {new Date(request.created_at).toLocaleTimeString("en-US", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                    {" - "}
                                    {new Date(request.created_at).toLocaleDateString("en-US", {
                                      month: "short",
                                      day: "numeric",
                                    })}
                                  </p>
                                </div>
                              </div>

                              {/* Thread messages */}
                              {(chatMessages[request.id] || []).map((msg) => {
                                const isBuilder = msg.sender_type === "builder";
                                return (
                                  <div
                                    key={msg.id}
                                    className={`flex ${isBuilder ? "justify-end" : "justify-start"}`}
                                  >
                                    <div className="max-w-[80%]">
                                      <div
                                        className={`flex items-center gap-2 mb-1 ${
                                          isBuilder ? "justify-end" : ""
                                        }`}
                                      >
                                        {isBuilder ? (
                                          <Wrench size={12} className="text-[var(--accent)]" />
                                        ) : (
                                          <User size={12} className="text-[var(--text-muted)]" />
                                        )}
                                        <span className="text-xs font-bold uppercase text-[var(--text-muted)]">
                                          {isBuilder ? "You" : request.sender_name}
                                        </span>
                                      </div>
                                      <div
                                        className="p-3"
                                        style={{
                                          backgroundColor: isBuilder ? "var(--accent)" : "var(--bg-surface)",
                                          color: isBuilder ? "var(--bg-surface)" : "var(--text-tertiary)",
                                          border: "2px solid var(--border-hard)",
                                          boxShadow: "var(--shadow-brutal-xs)",
                                        }}
                                      >
                                        <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                                      </div>
                                      <p
                                        className={`text-xs text-[var(--text-muted-soft)] mt-1 ${
                                          isBuilder ? "text-right" : ""
                                        }`}
                                      >
                                        {new Date(msg.created_at).toLocaleTimeString("en-US", {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}
                                        {" - "}
                                        {new Date(msg.created_at).toLocaleDateString("en-US", {
                                          month: "short",
                                          day: "numeric",
                                        })}
                                      </p>
                                    </div>
                                  </div>
                                );
                              })}

                              {(chatMessages[request.id] || []).length === 0 && (
                                <div className="text-center py-4">
                                  <p className="text-xs text-[var(--text-muted-soft)] font-medium">
                                    No replies yet. Send a message to start the conversation.
                                  </p>
                                </div>
                              )}
                            </>
                          )}
                          <div ref={chatEndRef} />
                        </div>
                      </div>

                      {/* Input area */}
                      <div
                        className="p-3 flex gap-2"
                        style={{
                          backgroundColor: "var(--bg-surface)",
                          borderTop: "2px solid var(--border-hard)",
                        }}
                      >
                        <textarea
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleSendReply(request.id);
                            }
                          }}
                          rows={2}
                          placeholder="Type your message..."
                          className="input-brutal resize-none flex-1"
                        />
                        <button
                          onClick={() => handleSendReply(request.id)}
                          disabled={!replyText.trim() || sendingReply}
                          className="btn-brutal self-end text-xs py-2.5 px-4 flex items-center gap-1.5 disabled:opacity-50"
                          style={{
                            backgroundColor: "var(--accent)",
                            color: "var(--text-on-inverted)",
                          }}
                        >
                          <Send size={14} />
                          {sendingReply ? "..." : "Send"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Onboarding tour. Mounts only when explicitly armed (post-signup
          sessionStorage flag) or when `?tour=force` is in the URL. The
          component itself returns null if the env flag is off, so this
          render is harmless when the feature is disabled. */}
      {showTour && (
        <OnboardingTour
          username={user?.username ?? null}
          forceOpen={tourForceOpen}
          onClose={() => setShowTour(false)}
        />
      )}
    </div>
  );
}
