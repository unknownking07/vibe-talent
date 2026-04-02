"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { fetchStreakLogs } from "@/lib/supabase/queries";
import { BadgeDisplay } from "@/components/ui/badge-display";
import type { UserWithSocials } from "@/lib/types/database";
import { StreakCounter } from "@/components/ui/streak-counter";
import { ActivityHeatmap } from "@/components/ui/activity-heatmap";
import { ProjectCard } from "@/components/ui/project-card";
import { ProfileViewsWidget } from "@/components/dashboard/profile-views-widget";
import { StreakMilestone } from "@/components/dashboard/streak-milestone";
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

export default function DashboardPage() {
  const [user, setUser] = useState<UserWithSocials | null>(null);
  const [heatmapData, setHeatmapData] = useState<Record<string, number>>({});
  const [ghTotal, setGhTotal] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [hireRequests, setHireRequests] = useState<HireRequest[]>([]);

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
      // Fetch profile + projects + socials + streaks + inbox ALL in parallel (single round trip)
      const results = await Promise.allSettled([
        sb.from("users").select("*").eq("id", authUser.id).single(),
        sb.from("projects").select("*").eq("user_id", authUser.id).order("created_at", { ascending: false }),
        sb.from("social_links").select("*").eq("user_id", authUser.id).single(),
        fetchStreakLogs(authUser.id),
        sb.from("hire_requests").select("*").eq("builder_id", authUser.id).order("created_at", { ascending: false }),
      ]);

      const profile = results[0].status === "fulfilled" ? results[0].value?.data : null;
      const projects = results[1].status === "fulfilled" ? results[1].value?.data : [];
      const socials = results[2].status === "fulfilled" ? results[2].value?.data : null;
      const streakData = results[3].status === "fulfilled" ? results[3].value : {};
      const inboxData = results[4].status === "fulfilled" ? results[4].value?.data : [];
      setHireRequests(inboxData || []);

      if (!profile) {
        window.location.href = "/auth/profile-setup";
        return;
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
      let calculatedStreak = 0;
      if (dates.length > 0) {
        const nowLocal = new Date();
        const today = `${nowLocal.getFullYear()}-${String(nowLocal.getMonth() + 1).padStart(2, "0")}-${String(nowLocal.getDate()).padStart(2, "0")}`;
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

      // Sync streak back to DB if it differs, so profile page shows the same value
      if (actualStreak !== (profile.streak || 0) || actualLongest !== (profile.longest_streak || 0)) {
        sb.from("users").update({
          streak: actualStreak,
          longest_streak: actualLongest,
        }).eq("id", authUser.id).then(() => {});
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

        // Fetch full GitHub contribution graph (runs in background)
        fetch("/api/github/contributions")
          .then(res => res.json())
          .then(ghData => {
            if (ghData.total) {
              setGhTotal(ghData.total);
            }
            if (ghData.contributions && Object.keys(ghData.contributions).length > 0) {
              setHeatmapData(prev => {
                // Merge: GitHub contributions as base, streak_logs overlay
                const merged = { ...ghData.contributions };
                for (const [date, level] of Object.entries(prev)) {
                  // Keep the higher value between GitHub data and streak logs
                  if (!merged[date] || (level as number) > merged[date]) {
                    merged[date] = level;
                  }
                }
                return merged;
              });
            }
          })
          .catch(console.error);
      }

      // Sync DB in background if streak was wrong (non-blocking)
      // Don't write vibe_score — the DB trigger is the single source of truth
      if (profile && (actualStreak !== profile.streak || actualLongest !== profile.longest_streak)) {
        sb.from("users").update({
          streak: actualStreak,
          longest_streak: actualLongest,
        }).eq("id", authUser.id);
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
  const [githubSkipped, setGithubSkipped] = useState(false);
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
  const [countdown, setCountdown] = useState("");
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
  const projectImageInputRef = useRef<HTMLInputElement>(null);
  const [imageDragging, setImageDragging] = useState(false);
  const [imageOffsetY, setImageOffsetY] = useState(50);
  const [imageZoom, setImageZoom] = useState(1);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const dragStartRef = useRef<{ y: number; startOffset: number } | null>(null);
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
    const { data: profile } = await sb.from("users").select("id, username, bio, avatar_url, vibe_score, streak, longest_streak, badge_level, referral_count, created_at").eq("id", authUser.id).single();
    if (!profile) return;
    const [{ data: projects }, { data: socials }, streakData] = await Promise.all([
      sb.from("projects").select("id, user_id, title, description, tech_stack, live_url, github_url, image_url, build_time, tags, verified, created_at").eq("user_id", authUser.id).order("created_at", { ascending: false }),
      sb.from("social_links").select("id, user_id, twitter, telegram, github, website, farcaster").eq("user_id", authUser.id).single(),
      fetchStreakLogs(authUser.id),
    ]);
    setUser({ ...profile, projects: projects || [], social_links: socials || null });
    setHeatmapData(streakData);
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
        setVerifyMessage({ projectId, success: false, text: data.reason || "Verification failed." });
      }
    } catch {
      setVerifyMessage({ projectId, success: false, text: "Verification request failed." });
    }
    setVerifyingProjectId(null);
  };

  const validateAndSetImage = (file: File) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      alert('Only JPG, PNG, WebP, and GIF images are allowed');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be under 5MB');
      return;
    }

    setProjectImageFile(file);
    setProjectImagePreview(URL.createObjectURL(file));
  };

  const handleProjectImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    validateAndSetImage(file);
  };

  const handleGithubSync = async () => {
    if (syncingGithub) return;
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
        const streakData = await fetchStreakLogs(user!.id);
        setHeatmapData(streakData);
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

  // Refresh inbox data directly from Supabase (skip API route hop)
  const loadInbox = async () => {
    setLoadingInbox(true);
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("hire_requests")
      .select("*")
      .eq("builder_id", user?.id)
      .order("created_at", { ascending: false });
    setHireRequests(data || []);
    setLoadingInbox(false);
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

  // Check if already logged today on mount
  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    sb.from("streak_logs").select("id").eq("user_id", user.id).eq("activity_date", today)
      .then(({ data }: { data: { id: string }[] | null }) => {
        if (data && data.length > 0) setTodayLogged(true);
      });
  }, [user]);

  // Countdown timer until midnight
  useEffect(() => {
    if (!todayLogged) return;
    const updateCountdown = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      const diff = midnight.getTime() - now.getTime();
      if (diff <= 0) {
        // Midnight passed — reset so user can log again
        setTodayLogged(false);
        setCountdown("");
        reloadUser();
        return;
      }
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setCountdown(`${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`);
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [todayLogged, reloadUser]);

  const handleLogActivity = async () => {
    if (!user || todayLogged || logging) return;
    setLogging(true);
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    const { error: insertError } = await sb.from("streak_logs").insert({
      user_id: user.id,
      activity_date: today,
    });

    if (insertError) {
      console.error("Failed to log activity:", insertError);
      setLogging(false);
      return;
    }

    // Optimistically update streak in UI
    const newStreak = user.streak + 1;
    const newLongest = Math.max(newStreak, user.longest_streak);
    setUser({ ...user, streak: newStreak, longest_streak: newLongest });
    setHeatmapData({ ...heatmapData, [today]: (heatmapData[today] || 0) + 1 });
    setTodayLogged(true);
    setLogging(false);

    // Also update DB directly in case trigger doesn't exist
    // Don't write vibe_score — the DB trigger is the single source of truth
    await sb.from("users").update({
      streak: newStreak,
      longest_streak: newLongest,
    }).eq("id", user.id);
  };

  const handleAddProject = async () => {
    if (!user || addingProject || !projectForm.title || !projectForm.description) return;
    setProjectError("");

    if (projectForm.description.length < 10) {
      setProjectError("Description must be at least 10 characters.");
      return;
    }
    if (!projectForm.live_url || !projectForm.live_url.trim()) {
      setProjectError("Live URL is required. Every project must have a deployed link.");
      return;
    }
    try {
      const url = new URL(projectForm.live_url.trim());
      if (url.protocol !== "https:") throw new Error();
    } catch {
      setProjectError("Live URL must be a valid URL starting with https://");
      return;
    }
    if (projectForm.github_url) {
      const ghPattern = /^https:\/\/github\.com\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+\/?$/;
      if (!ghPattern.test(projectForm.github_url.trim())) {
        setProjectError("GitHub URL must be in the format: https://github.com/username/repo");
        return;
      }
    } else if (!githubSkipped) {
      setProjectError("Adding a GitHub URL helps verify your project and boosts your quality score. Click submit again to skip.");
      setGithubSkipped(true);
      return;
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
      live_url: projectForm.live_url || null,
      github_url: projectForm.github_url || null,
      build_time: projectForm.build_time || null,
      tags: projectForm.tags ? projectForm.tags.split(",").map((t: string) => t.trim()).filter(Boolean) : [],
    }).select("id").single();

    if (error) {
      console.error("Failed to add project:", error);
      setAddingProject(false);
      return;
    }

    // Upload project image if selected
    if (projectImageFile && insertedProject?.id) {
      const ext = projectImageFile.name.split(".").pop();
      const filePath = `${user.id}/${insertedProject.id}/image.${ext}`;
      const { error: uploadError } = await sb.storage.from("project-images").upload(filePath, projectImageFile, { upsert: true });
      if (!uploadError) {
        const { data: { publicUrl } } = sb.storage.from("project-images").getPublicUrl(filePath);
        await sb.from("projects").update({ image_url: `${publicUrl}?t=${Date.now()}&y=${Math.round(imageOffsetY)}&z=${imageZoom.toFixed(2)}` }).eq("id", insertedProject.id);
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
    setProjectImagePreview(null);
    setImageOffsetY(50);
    setImageZoom(1);
    setShowProjectForm(false);
    setAddingProject(false);
    setGithubSkipped(false);

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
    // Load existing image preview and crop settings
    setProjectImageFile(null);
    setProjectImagePreview(project.image_url || null);
    if (project.image_url) {
      try {
        const u = new URL(project.image_url);
        setImageOffsetY(parseInt(u.searchParams.get("y") || "50"));
        setImageZoom(parseFloat(u.searchParams.get("z") || "1"));
      } catch {
        setImageOffsetY(50);
        setImageZoom(1);
      }
    } else {
      setImageOffsetY(50);
      setImageZoom(1);
    }
    setShowProjectForm(true);
  };

  const handleSaveEdit = async () => {
    if (!user || !editingProjectId || savingEdit || !projectForm.title || !projectForm.description) return;
    setProjectError("");

    if (projectForm.description.length < 10) {
      setProjectError("Description must be at least 10 characters.");
      return;
    }
    if (!projectForm.live_url || !projectForm.live_url.trim()) {
      setProjectError("Live URL is required. Every project must have a deployed link.");
      return;
    }
    try {
      const url = new URL(projectForm.live_url.trim());
      if (url.protocol !== "https:") throw new Error();
    } catch {
      setProjectError("Live URL must be a valid URL starting with https://");
      return;
    }
    if (projectForm.github_url) {
      const ghPattern = /^https:\/\/github\.com\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+\/?$/;
      if (!ghPattern.test(projectForm.github_url.trim())) {
        setProjectError("GitHub URL must be in the format: https://github.com/username/repo");
        return;
      }
    } else if (!githubSkipped) {
      setProjectError("Adding a GitHub URL helps verify your project and boosts your quality score. Click save again to skip.");
      setGithubSkipped(true);
      return;
    }

    setSavingEdit(true);
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;

    const { error } = await sb.from("projects").update({
      title: projectForm.title,
      description: projectForm.description,
      tech_stack: projectForm.tech_stack ? projectForm.tech_stack.split(",").map((t: string) => t.trim()).filter(Boolean) : [],
      live_url: projectForm.live_url || null,
      github_url: projectForm.github_url || null,
      build_time: projectForm.build_time || null,
      tags: projectForm.tags ? projectForm.tags.split(",").map((t: string) => t.trim()).filter(Boolean) : [],
    }).eq("id", editingProjectId);

    if (error) {
      console.error("Failed to update project:", error);
      setSavingEdit(false);
      return;
    }

    // Upload project image if a new file was selected
    if (projectImageFile && user && editingProjectId) {
      const ext = projectImageFile.name.split(".").pop();
      const filePath = `${user.id}/${editingProjectId}/image.${ext}`;
      const { error: uploadError } = await sb.storage.from("project-images").upload(filePath, projectImageFile, { upsert: true });
      if (!uploadError) {
        const { data: { publicUrl } } = sb.storage.from("project-images").getPublicUrl(filePath);
        await sb.from("projects").update({ image_url: `${publicUrl}?t=${Date.now()}&y=${Math.round(imageOffsetY)}&z=${imageZoom.toFixed(2)}` }).eq("id", editingProjectId);
      }
    } else if (!projectImageFile && projectImagePreview && editingProjectId) {
      // User repositioned/zoomed existing image without uploading a new one
      const baseUrl = projectImagePreview.split("?")[0];
      await sb.from("projects").update({ image_url: `${baseUrl}?t=${Date.now()}&y=${Math.round(imageOffsetY)}&z=${imageZoom.toFixed(2)}` }).eq("id", editingProjectId);
    }

    await reloadUser();

    // Auto-verify if GitHub URL changed
    const githubUrlChanged = projectForm.github_url !== editingOriginalGithubUrl;
    const savedEditingId = editingProjectId;

    setProjectForm({ title: "", description: "", tech_stack: "", live_url: "", github_url: "", build_time: "", tags: "" });
    setProjectImageFile(null);
    setProjectImagePreview(null);
    setImageOffsetY(50);
    setImageZoom(1);
    setShowProjectForm(false);
    setEditingProjectId(null);
    setEditingOriginalGithubUrl("");
    setSavingEdit(false);
    setGithubSkipped(false);

    if (githubUrlChanged && projectForm.github_url && savedEditingId) {
      verifyProject(savedEditingId);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
        <h1 className="text-3xl font-extrabold uppercase text-[var(--foreground)] mb-8">Dashboard</h1>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-24" />)}
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
          {hireRequests.filter((r) => r.status === "new").length > 0 && (
            <span
              className="ml-1 px-2 py-0.5 text-xs font-extrabold"
              style={{
                backgroundColor: "var(--accent)",
                color: "var(--text-on-inverted)",
                border: "2px solid var(--border-hard)",
              }}
            >
              {hireRequests.filter((r) => r.status === "new").length}
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
                setProjectImagePreview(null);
                setImageOffsetY(50);
                setImageZoom(1);
                setGithubSkipped(false);
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
              <textarea
                placeholder="Description"
                value={projectForm.description}
                onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                rows={2}
                className="input-brutal resize-none"
              />
              <input
                type="text"
                placeholder="Tech stack (comma separated)"
                value={projectForm.tech_stack}
                onChange={(e) => setProjectForm({ ...projectForm, tech_stack: e.target.value })}
                className="input-brutal"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Live URL (required) *"
                  value={projectForm.live_url}
                  onChange={(e) => setProjectForm({ ...projectForm, live_url: e.target.value })}
                  className="input-brutal"
                  required
                />
                <input
                  type="text"
                  placeholder="GitHub URL (recommended)"
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
                      className="relative w-full border-2 border-[var(--border-hard)] overflow-hidden select-none"
                      style={{ height: 120, cursor: isDraggingImage ? "grabbing" : "grab" }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setIsDraggingImage(true);
                        dragStartRef.current = { y: e.clientY, startOffset: imageOffsetY };
                      }}
                      onMouseMove={(e) => {
                        if (!isDraggingImage || !dragStartRef.current) return;
                        const delta = e.clientY - dragStartRef.current.y;
                        const newOffset = Math.min(100, Math.max(0, dragStartRef.current.startOffset + delta * 0.5));
                        setImageOffsetY(newOffset);
                      }}
                      onMouseUp={() => { setIsDraggingImage(false); dragStartRef.current = null; }}
                      onMouseLeave={() => { setIsDraggingImage(false); dragStartRef.current = null; }}
                      onTouchStart={(e) => {
                        const touch = e.touches[0];
                        setIsDraggingImage(true);
                        dragStartRef.current = { y: touch.clientY, startOffset: imageOffsetY };
                      }}
                      onTouchMove={(e) => {
                        if (!isDraggingImage || !dragStartRef.current) return;
                        const delta = e.touches[0].clientY - dragStartRef.current.y;
                        const newOffset = Math.min(100, Math.max(0, dragStartRef.current.startOffset + delta * 0.5));
                        setImageOffsetY(newOffset);
                      }}
                      onTouchEnd={() => { setIsDraggingImage(false); dragStartRef.current = null; }}
                    >
                      <Image
                        src={projectImagePreview}
                        alt="Preview"
                        fill
                        className="object-cover pointer-events-none"
                        style={{ objectPosition: `center ${imageOffsetY}%`, transform: `scale(${imageZoom})` }}
                        draggable={false}
                      />
                      <div className="absolute top-2 right-2 flex gap-2">
                        <button type="button" onClick={(e) => { e.stopPropagation(); projectImageInputRef.current?.click(); }} className="w-7 h-7 bg-black/60 text-white rounded-full flex items-center justify-center text-xs hover:bg-black/80 transition-colors" title="Change image">
                          <Camera size={14} />
                        </button>
                        <button type="button" onClick={(e) => { e.stopPropagation(); setProjectImageFile(null); setProjectImagePreview(null); setImageOffsetY(50); setImageZoom(1); }} className="w-7 h-7 bg-black/60 text-white rounded-full flex items-center justify-center text-xs hover:bg-black/80 transition-colors" title="Remove image">&times;</button>
                      </div>
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/60 rounded-full text-[10px] text-white font-bold uppercase pointer-events-none">
                        Drag to reposition
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[10px] font-bold uppercase text-[var(--text-muted)]">Zoom</span>
                      <input
                        type="range"
                        min="1"
                        max="2"
                        step="0.05"
                        value={imageZoom}
                        onChange={(e) => setImageZoom(parseFloat(e.target.value))}
                        className="flex-1 h-1 accent-[var(--accent)]"
                      />
                      <span className="text-[10px] font-mono text-[var(--text-muted)]">{Math.round(imageZoom * 100)}%</span>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className={`w-full border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] ${imageDragging ? "border-[var(--accent)] bg-[rgba(255,58,0,0.06)]" : "border-[var(--border-hard)] hover:border-[var(--accent)]"}`}
                    style={{ height: 120 }}
                    onClick={() => projectImageInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setImageDragging(true); }}
                    onDragLeave={() => setImageDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setImageDragging(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) validateAndSetImage(file);
                    }}
                    aria-label="Upload project screenshot"
                  >
                    <Camera size={20} className="text-[var(--text-muted)]" />
                    <span className="text-xs font-bold uppercase text-[var(--text-muted)]">Drag & drop or click to upload</span>
                    <span className="text-[10px] text-[var(--text-muted-soft)]">Max 5MB. JPG, PNG, WebP, GIF.</span>
                  </button>
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
                <span className="text-sm font-extrabold font-mono text-[var(--status-success-text)]">{countdown}</span>
              </div>
            </div>
          ) : (
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
            const siteUrl = "https://www.vibetalent.work";
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
                          {request.sender_name}
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
    </div>
  );
}
