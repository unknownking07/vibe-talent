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
  Users,
} from "lucide-react";

/**
 * Extract a bare username from a value that might be a full URL or @-prefixed handle.
 * For twitter/github/telegram: strips common URL prefixes and leading @.
 * Returns just the username portion.
 */
function extractUsername(value: string, platform: "twitter" | "github" | "telegram"): string {
  let v = value.trim();
  if (!v) return "";

  // Remove trailing slashes
  v = v.replace(/\/+$/, "");

  // Strip known URL prefixes
  const patterns: Record<string, RegExp[]> = {
    twitter: [/^https?:\/\/(www\.)?(twitter|x)\.com\//i],
    github: [/^https?:\/\/(www\.)?github\.com\//i],
    telegram: [/^https?:\/\/(www\.)?(t\.me|telegram\.me)\//i],
  };

  for (const re of patterns[platform]) {
    v = v.replace(re, "");
  }

  // Remove leading @
  v = v.replace(/^@/, "");

  // Drop query/hash and take only first segment
  v = v.split(/[?#]/)[0];
  v = v.split("/")[0];
  v = v.trim();

  return v;
}

export default function DashboardPage() {
  const [user, setUser] = useState<UserWithSocials | null>(null);
  const [heatmapData, setHeatmapData] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [hireRequests, setHireRequests] = useState<HireRequest[]>([]);
  const [referralCopied, setReferralCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let loaded = false;

    async function loadUserData(authUser: import("@supabase/supabase-js").User) {
      if (loaded || cancelled) return;
      loaded = true;
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;

      // Fetch profile + projects + socials + streaks + inbox ALL in parallel (single round trip)
      const [{ data: profile }, { data: projects }, { data: socials }, streakData, { data: inboxData }] = await Promise.all([
        sb.from("users").select("id, username, bio, avatar_url, vibe_score, streak, longest_streak, badge_level, streak_freezes_remaining, streak_freezes_used, referral_count, created_at").eq("id", authUser.id).single(),
        sb.from("projects").select("id, user_id, title, description, tech_stack, live_url, github_url, image_url, build_time, tags, verified, created_at").eq("user_id", authUser.id).order("created_at", { ascending: false }),
        sb.from("social_links").select("id, user_id, twitter, telegram, github, website, farcaster").eq("user_id", authUser.id).single(),
        fetchStreakLogs(authUser.id),
        sb.from("hire_requests").select("*").eq("builder_id", authUser.id).order("created_at", { ascending: false }),
      ]);
      setHireRequests(inboxData || []);

      if (!profile) {
        window.location.href = "/auth/profile-setup";
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

      const actualStreak = Math.max(profile.streak, calculatedStreak);
      const actualLongest = Math.max(profile.longest_streak, calculatedStreak);

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
                  setHeatmapData(newStreakData);
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
      }

      // Sync DB in background if streak was wrong (non-blocking)
      // Don't write vibe_score — the DB trigger is the single source of truth
      if (actualStreak !== profile.streak || actualLongest !== profile.longest_streak) {
        sb.from("users").update({
          streak: actualStreak,
          longest_streak: actualLongest,
        }).eq("id", authUser.id);
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

  const [profileForm, setProfileForm] = useState({
    username: "",
    bio: "",
    twitter: "",
    github: "",
    telegram: "",
    website: "",
    ide: "",
  });

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (user) {
      setProfileForm({
        username: user.username,
        bio: user.bio || "",
        twitter: user.social_links?.twitter || "",
        github: user.social_links?.github || "",
        telegram: user.social_links?.telegram || "",
        website: user.social_links?.website || "",
        ide: user.social_links?.farcaster || "",
      });
    }
  }, [user]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const [todayLogged, setTodayLogged] = useState(false);
  const [logging, setLogging] = useState(false);
  const [countdown, setCountdown] = useState("");
  const [saving, setSaving] = useState(false);
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
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [verifyingProjectId, setVerifyingProjectId] = useState<string | null>(null);
  const [verifyMessage, setVerifyMessage] = useState<{ projectId: string; success: boolean; text: string } | null>(null);
  const [showVerifyGuide, setShowVerifyGuide] = useState(true);
  const [projectImageFile, setProjectImageFile] = useState<File | null>(null);
  const [projectImagePreview, setProjectImagePreview] = useState<string | null>(null);
  const projectImageInputRef = useRef<HTMLInputElement>(null);
  const [syncingGithub, setSyncingGithub] = useState(false);
  const [githubSyncResult, setGithubSyncResult] = useState<string | null>(null);
  const [lastSyncLabel, setLastSyncLabel] = useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect */
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
  /* eslint-enable react-hooks/set-state-in-effect */

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

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      alert('Only JPG, PNG, WebP, and GIF images are allowed');
      return;
    }

    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be under 2MB');
      return;
    }

    setUploadingAvatar(true);
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const ext = file.name.split(".").pop();
    const filePath = `${user.id}/avatar.${ext}`;

    // Upload to storage
    const { error: uploadError } = await sb.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      console.error("Upload failed:", uploadError);
      setUploadingAvatar(false);
      return;
    }

    // Get public URL
    const { data: { publicUrl } } = sb.storage
      .from("avatars")
      .getPublicUrl(filePath);

    // Add cache-busting timestamp
    const avatarUrl = `${publicUrl}?t=${Date.now()}`;

    // Update user record
    await sb.from("users").update({ avatar_url: avatarUrl }).eq("id", user.id);
    setUser({ ...user, avatar_url: avatarUrl });
    setUploadingAvatar(false);
  };

  const handleProjectImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
    chatPollRef.current = setInterval(() => loadChatMessages(requestId), 5000);
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

  const handleSaveProfile = async () => {
    if (!user || saving) return;
    setSaving(true);
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;

    await sb
      .from("users")
      .update({ username: profileForm.username, bio: profileForm.bio })
      .eq("id", user.id);

    // Upsert social links (farcaster column stores IDE choice)
    await sb.from("social_links").upsert({
      user_id: user.id,
      twitter: profileForm.twitter || null,
      github: profileForm.github || null,
      telegram: profileForm.telegram || null,
      website: profileForm.website || null,
      farcaster: profileForm.ide || null,
    }, { onConflict: "user_id" });

    setUser({
      ...user,
      username: profileForm.username,
      bio: profileForm.bio,
      social_links: {
        id: user.social_links?.id || "",
        user_id: user.id,
        twitter: profileForm.twitter || null,
        github: profileForm.github || null,
        telegram: profileForm.telegram || null,
        website: profileForm.website || null,
        farcaster: profileForm.ide || null,
      },
    });
    setSaving(false);
  };

  const handleAddProject = async () => {
    if (!user || addingProject || !projectForm.title || !projectForm.description) return;
    setProjectError("");

    if (projectForm.description.length < 10) {
      setProjectError("Description must be at least 10 characters.");
      return;
    }
    if (projectForm.github_url) {
      const ghPattern = /^https:\/\/github\.com\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+\/?$/;
      if (!ghPattern.test(projectForm.github_url.trim())) {
        setProjectError("GitHub URL must be in the format: https://github.com/username/repo");
        return;
      }
    }
    if (projectForm.live_url) {
      try {
        const url = new URL(projectForm.live_url.trim());
        if (!["http:", "https:"].includes(url.protocol)) throw new Error();
      } catch {
        setProjectError("Live URL must be a valid URL starting with http:// or https://");
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
    setProjectImagePreview(null);
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
    // Load existing image preview
    setProjectImageFile(null);
    setProjectImagePreview(project.image_url || null);
    setShowProjectForm(true);
  };

  const handleSaveEdit = async () => {
    if (!user || !editingProjectId || savingEdit || !projectForm.title || !projectForm.description) return;
    setProjectError("");

    if (projectForm.description.length < 10) {
      setProjectError("Description must be at least 10 characters.");
      return;
    }
    if (projectForm.github_url) {
      const ghPattern = /^https:\/\/github\.com\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+\/?$/;
      if (!ghPattern.test(projectForm.github_url.trim())) {
        setProjectError("GitHub URL must be in the format: https://github.com/username/repo");
        return;
      }
    }
    if (projectForm.live_url) {
      try {
        const url = new URL(projectForm.live_url.trim());
        if (!["http:", "https:"].includes(url.protocol)) throw new Error();
      } catch {
        setProjectError("Live URL must be a valid URL starting with http:// or https://");
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
        await sb.from("projects").update({ image_url: `${publicUrl}?t=${Date.now()}` }).eq("id", editingProjectId);
      }
    }

    await reloadUser();

    // Auto-verify if GitHub URL changed
    const githubUrlChanged = projectForm.github_url !== editingOriginalGithubUrl;
    const savedEditingId = editingProjectId;

    setProjectForm({ title: "", description: "", tech_stack: "", live_url: "", github_url: "", build_time: "", tags: "" });
    setProjectImageFile(null);
    setProjectImagePreview(null);
    setShowProjectForm(false);
    setEditingProjectId(null);
    setEditingOriginalGithubUrl("");
    setSavingEdit(false);

    if (githubUrlChanged && projectForm.github_url && savedEditingId) {
      verifyProject(savedEditingId);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
        <h1 className="text-3xl font-extrabold uppercase text-[#0F0F0F] mb-8">Dashboard</h1>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-24" />)}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12 text-center">
        <h1 className="text-3xl font-extrabold uppercase text-[#0F0F0F] mb-4">Dashboard</h1>
        <p className="text-[#52525B] font-medium">Please sign in to view your dashboard.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
      <h1 className="text-3xl font-extrabold uppercase text-[#0F0F0F] mb-6">Dashboard</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-8">
        <button
          onClick={() => setActiveTab("overview")}
          className="px-5 py-2.5 text-sm font-extrabold uppercase tracking-wide transition-all"
          style={{
            backgroundColor: activeTab === "overview" ? "#0F0F0F" : "#FFFFFF",
            color: activeTab === "overview" ? "#FFFFFF" : "#0F0F0F",
            border: "2px solid #0F0F0F",
            boxShadow: activeTab === "overview" ? "none" : "4px 4px 0 #000",
          }}
        >
          Overview
        </button>
        <button
          onClick={() => { setActiveTab("inbox"); if (user) loadInbox(); }}
          className="px-5 py-2.5 text-sm font-extrabold uppercase tracking-wide transition-all flex items-center gap-2"
          style={{
            backgroundColor: activeTab === "inbox" ? "#0F0F0F" : "#FFFFFF",
            color: activeTab === "inbox" ? "#FFFFFF" : "#0F0F0F",
            border: "2px solid #0F0F0F",
            boxShadow: activeTab === "inbox" ? "none" : "4px 4px 0 #000",
          }}
        >
          <Inbox size={16} />
          Inbox
          {hireRequests.filter((r) => r.status === "new").length > 0 && (
            <span
              className="ml-1 px-2 py-0.5 text-xs font-extrabold"
              style={{
                backgroundColor: "var(--accent)",
                color: "#FFFFFF",
                border: "2px solid #0F0F0F",
              }}
            >
              {hireRequests.filter((r) => r.status === "new").length}
            </span>
          )}
        </button>
      </div>

      {activeTab === "overview" && (
      <>
      {/* Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div
          className="p-5"
          style={{
            backgroundColor: "#FFFFFF",
            border: "2px solid #0F0F0F",
            boxShadow: "var(--shadow-brutal-sm)",
          }}
        >
          <Flame size={20} className="text-[var(--accent)] mb-2" />
          <div className="text-2xl font-extrabold font-mono text-[#0F0F0F]">{user.streak}</div>
          <div className="text-xs font-bold uppercase tracking-wide text-[#71717A] mt-1">Current Streak</div>
        </div>
        <div
          className="p-5"
          style={{
            backgroundColor: "#FFFFFF",
            border: "2px solid #0F0F0F",
            boxShadow: "var(--shadow-brutal-sm)",
          }}
        >
          <Trophy size={20} className="text-[#CA8A04] mb-2" />
          <div className="text-2xl font-extrabold font-mono text-[#0F0F0F]">{user.longest_streak}</div>
          <div className="text-xs font-bold uppercase tracking-wide text-[#71717A] mt-1">Longest Streak</div>
        </div>
        <div
          className="p-5"
          style={{
            backgroundColor: "#FFFFFF",
            border: "2px solid #0F0F0F",
            boxShadow: "var(--shadow-brutal-sm)",
          }}
        >
          <Zap size={20} className="text-[var(--accent)] fill-[var(--accent)] mb-2" />
          <div className="text-2xl font-extrabold font-mono text-[var(--accent)]">{user.vibe_score}</div>
          <div className="text-xs font-bold uppercase tracking-wide text-[#71717A] mt-1">Vibe Score</div>
        </div>
        <div
          className="p-5"
          style={{
            backgroundColor: "#FFFFFF",
            border: "2px solid #0F0F0F",
            boxShadow: "var(--shadow-brutal-sm)",
          }}
        >
          <Code2 size={20} className="text-[var(--accent)] mb-2" />
          <div className="text-2xl font-extrabold font-mono text-[#0F0F0F]">{user.projects.length}</div>
          <div className="text-xs font-bold uppercase tracking-wide text-[#71717A] mt-1">Projects</div>
        </div>
      </div>

      {/* Log Activity */}
      <div
        className="p-6 mb-8"
        style={{
          backgroundColor: "#FFFFFF",
          border: "2px solid #0F0F0F",
          boxShadow: "var(--shadow-brutal)",
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-extrabold uppercase flex items-center gap-2 text-[#0F0F0F]">
              <Flame size={20} className="text-[var(--accent)]" />
              {todayLogged ? "Activity Logged Today" : "Log Today\u0027s Activity"}
            </h2>
            <p className="text-sm text-[#52525B] font-medium mt-1">
              {todayLogged
                ? "You\u0027ve already logged your activity today. Come back tomorrow!"
                : "Log your coding activity to keep your streak alive"}
            </p>
          </div>
          {todayLogged ? (
            <div
              className="text-center px-4 py-2"
              style={{
                backgroundColor: "#D1FAE5",
                border: "2px solid #0F0F0F",
                boxShadow: "var(--shadow-brutal-sm)",
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <Check size={14} className="text-[#065F46]" />
                <span className="text-xs font-bold uppercase text-[#065F46]">Done for today</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock size={12} className="text-[#065F46]" />
                <span className="text-sm font-extrabold font-mono text-[#065F46]">{countdown}</span>
              </div>
            </div>
          ) : (
            <button
              onClick={handleLogActivity}
              disabled={logging}
              className="btn-brutal text-sm"
              style={{
                backgroundColor: "var(--accent)",
                color: "#FFFFFF",
              }}
            >
              {logging ? "Logging..." : "Log Activity"}
            </button>
          )}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <StreakCounter streak={user.streak} size="lg" />
          <span className="text-sm font-bold text-[#52525B] uppercase">day streak</span>
        </div>
        <div className="mt-2">
          <BadgeDisplay level={user.badge_level} />
        </div>
        {/* Streak Freeze Status */}
        <div className="mt-3 flex items-center gap-2">
          <ShieldCheck size={16} className="text-cyan-600" />
          <span className="text-sm font-bold text-[#52525B]">
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
                <Code2 size={16} className="text-[#52525B]" />
                <span className="text-sm font-bold text-[#52525B]">GitHub Auto-Sync</span>
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

      {/* Activity Heatmap */}
      <div
        className="p-6 mb-8"
        style={{
          backgroundColor: "#FFFFFF",
          border: "2px solid #0F0F0F",
          boxShadow: "var(--shadow-brutal)",
        }}
      >
        <h2 className="text-lg font-extrabold uppercase text-[#0F0F0F] mb-4">Your Activity</h2>
        <ActivityHeatmap data={heatmapData} />
      </div>

      {/* Referral */}
      <div
        className="p-6 mb-8"
        style={{
          backgroundColor: "#FFFFFF",
          border: "2px solid #0F0F0F",
          boxShadow: "var(--shadow-brutal)",
        }}
      >
        <h2 className="text-lg font-extrabold uppercase flex items-center gap-2 text-[#0F0F0F] mb-2">
          <Users size={20} className="text-[var(--accent)]" />
          Invite Builders
        </h2>
        <p className="text-sm text-[#52525B] font-medium mb-4">
          Share your referral link. When someone signs up, you get a bonus streak day!
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            readOnly
            value={`${typeof window !== "undefined" ? window.location.origin : "https://vibetalent.work"}/auth/signup?ref=${user.username}`}
            className="input-brutal flex-1 text-sm font-mono"
          />
          <button
            onClick={() => {
              navigator.clipboard.writeText(`${window.location.origin}/auth/signup?ref=${user.username}`);
              setReferralCopied(true);
              setTimeout(() => setReferralCopied(false), 2000);
            }}
            className="btn-brutal text-sm px-4"
            style={{
              backgroundColor: referralCopied ? "#D1FAE5" : "var(--accent)",
              color: referralCopied ? "#065F46" : "#FFFFFF",
            }}
          >
            {referralCopied ? "Copied!" : "Copy"}
          </button>
        </div>
        {(user.referral_count ?? 0) > 0 && (
          <p className="text-sm font-bold text-[#0F0F0F] mt-3">
            You&apos;ve referred {user.referral_count} builder{user.referral_count !== 1 ? "s" : ""}!
          </p>
        )}
      </div>

      {/* Embeddable Badge */}
      <div
        className="p-6 mb-8"
        style={{
          backgroundColor: "#FFFFFF",
          border: "2px solid #0F0F0F",
          boxShadow: "var(--shadow-brutal)",
        }}
      >
        <h2 className="text-lg font-extrabold uppercase flex items-center gap-2 text-[#0F0F0F] mb-4">
          <ExternalLink size={20} className="text-[var(--accent)]" />
          Embeddable Badge
        </h2>
        <p className="text-sm text-[#52525B] font-medium mb-4">
          Add your VibeTalent badge to your GitHub README or website
        </p>

        {/* Badge Preview */}
        <div className="mb-4 p-4 bg-zinc-50 border-2 border-zinc-200 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/badge/${user.username}`}
            alt={`${user.username}'s VibeTalent badge`}
            height={36}
          />
        </div>

        {/* Copy Markdown */}
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold uppercase tracking-wide text-[#71717A]">Markdown (GitHub README)</label>
              <button
                onClick={() => {
                  const siteUrl = window.location.origin;
                  navigator.clipboard.writeText(`[![VibeTalent](${siteUrl}/api/badge/${user.username})](${siteUrl}/profile/${user.username})`);
                  setBadgeCopied("md");
                  setTimeout(() => setBadgeCopied(null), 2000);
                }}
                className="text-xs font-bold text-[var(--accent)] hover:underline"
              >
                {badgeCopied === "md" ? "Copied!" : "Copy"}
              </button>
            </div>
            <code className="block p-2 text-xs font-mono bg-zinc-100 border-2 border-zinc-200 break-all">
              {`[![VibeTalent](${typeof window !== "undefined" ? window.location.origin : "https://vibetalent.work"}/api/badge/${user.username})](${typeof window !== "undefined" ? window.location.origin : "https://vibetalent.work"}/profile/${user.username})`}
            </code>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold uppercase tracking-wide text-[#71717A]">HTML (Website)</label>
              <button
                onClick={() => {
                  const siteUrl = window.location.origin;
                  navigator.clipboard.writeText(`<a href="${siteUrl}/profile/${user.username}"><img src="${siteUrl}/api/badge/${user.username}" alt="VibeTalent Badge" /></a>`);
                  setBadgeCopied("html");
                  setTimeout(() => setBadgeCopied(null), 2000);
                }}
                className="text-xs font-bold text-[var(--accent)] hover:underline"
              >
                {badgeCopied === "html" ? "Copied!" : "Copy"}
              </button>
            </div>
            <code className="block p-2 text-xs font-mono bg-zinc-100 border-2 border-zinc-200 break-all">
              {`<a href="${typeof window !== "undefined" ? window.location.origin : "https://vibetalent.work"}/profile/${user.username}"><img src="${typeof window !== "undefined" ? window.location.origin : "https://vibetalent.work"}/api/badge/${user.username}" alt="VibeTalent Badge" /></a>`}
            </code>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Edit Profile */}
        <div
          className="p-6"
          style={{
            backgroundColor: "#FFFFFF",
            border: "2px solid #0F0F0F",
            boxShadow: "var(--shadow-brutal)",
          }}
        >
          <h2 className="text-lg font-extrabold uppercase text-[#0F0F0F] mb-4">Edit Profile</h2>
          <div className="space-y-4">
            {/* Avatar Upload */}
            <div className="flex items-center gap-4">
              <div
                className="relative w-20 h-20 flex items-center justify-center text-2xl font-extrabold text-white cursor-pointer group"
                style={{ backgroundColor: "#0F0F0F", border: "2px solid #0F0F0F" }}
                onClick={() => avatarInputRef.current?.click()}
              >
                {user.avatar_url ? (
                  <Image src={user.avatar_url} alt={user.username} width={80} height={80} className="w-full h-full object-cover" />
                ) : (
                  user.username.slice(0, 2).toUpperCase()
                )}
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera size={20} className="text-white" />
                </div>
              </div>
              <div>
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="text-sm font-bold text-[var(--accent)] hover:underline"
                >
                  {uploadingAvatar ? "Uploading..." : "Change Avatar"}
                </button>
                <p className="text-xs text-[#71717A] mt-1">JPG, PNG. Max 2MB.</p>
              </div>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-[#71717A] mb-1.5 block">Username</label>
              <input
                type="text"
                value={profileForm.username}
                onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })}
                className="input-brutal"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-[#71717A] mb-1.5 block">Bio</label>
              <textarea
                value={profileForm.bio}
                onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                rows={3}
                className="input-brutal resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-[#71717A] mb-1.5 block">X (Twitter)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A1A1AA] font-bold text-sm select-none">@</span>
                  <input
                    type="text"
                    value={profileForm.twitter}
                    onChange={(e) => setProfileForm({ ...profileForm, twitter: extractUsername(e.target.value, "twitter") })}
                    placeholder="username"
                    className="input-brutal"
                    style={{ paddingLeft: "1.75rem" }}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-[#71717A] mb-1.5 block">GitHub</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A1A1AA] font-bold text-sm select-none">@</span>
                  <input
                    type="text"
                    value={profileForm.github}
                    onChange={(e) => setProfileForm({ ...profileForm, github: extractUsername(e.target.value, "github") })}
                    placeholder="username"
                    className="input-brutal"
                    style={{ paddingLeft: "1.75rem" }}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-[#71717A] mb-1.5 block">Telegram</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A1A1AA] font-bold text-sm select-none">@</span>
                  <input
                    type="text"
                    value={profileForm.telegram}
                    onChange={(e) => setProfileForm({ ...profileForm, telegram: extractUsername(e.target.value, "telegram") })}
                    placeholder="username"
                    className="input-brutal"
                    style={{ paddingLeft: "1.75rem" }}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-[#71717A] mb-1.5 block">Portfolio</label>
                <input
                  type="text"
                  value={profileForm.website}
                  onChange={(e) => setProfileForm({ ...profileForm, website: e.target.value })}
                  placeholder="https://..."
                  className="input-brutal"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-[#71717A] mb-1.5 block">Vibe Coding IDE</label>
              <select
                value={profileForm.ide}
                onChange={(e) => setProfileForm({ ...profileForm, ide: e.target.value })}
                className="input-brutal"
              >
                <option value="">Select your IDE...</option>
                <option value="Claude Code (Pro)">Claude Code (Pro)</option>
                <option value="Claude Code (Max 5x)">Claude Code (Max 5x)</option>
                <option value="Claude Code (Max 20x)">Claude Code (Max 20x)</option>
                <option value="Cursor">Cursor</option>
                <option value="Windsurf">Windsurf</option>
                <option value="Antigravity">Antigravity</option>
                <option value="Bolt">Bolt</option>
                <option value="Lovable">Lovable</option>
                <option value="Replit Agent">Replit Agent</option>
                <option value="GitHub Copilot">GitHub Copilot</option>
                <option value="VS Code + AI">VS Code + AI</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="btn-brutal btn-brutal-primary text-sm flex items-center gap-2"
            >
              <Save size={16} />
              {saving ? "Saving..." : "Save Profile"}
            </button>
          </div>
        </div>

        {/* Projects */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-extrabold uppercase text-[#0F0F0F]">Your Projects</h2>
            <button
              onClick={() => {
                if (showProjectForm) {
                  setShowProjectForm(false);
                  setEditingProjectId(null);
                  setProjectForm({ title: "", description: "", tech_stack: "", live_url: "", github_url: "", build_time: "", tags: "" });
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
              style={{ backgroundColor: "#FFFBEB", border: "2px solid #0F0F0F" }}
            >
              <button
                onClick={() => setShowVerifyGuide(false)}
                className="absolute top-3 right-3 text-[#A1A1AA] hover:text-[#0F0F0F] transition-colors"
                title="Dismiss"
              >
                <X size={14} />
              </button>
              <h3 className="text-sm font-extrabold uppercase text-[#0F0F0F] flex items-center gap-2 mb-2">
                <ShieldCheck size={16} className="text-green-600" />
                How to Verify Your Projects
              </h3>
              <p className="text-xs text-[#52525B] font-medium leading-relaxed">
                Verified projects show a green badge, proving you own the code. There are two ways to verify:
              </p>
              <ol className="text-xs text-[#52525B] font-medium mt-2 space-y-1.5 list-decimal list-inside leading-relaxed">
                <li>
                  <strong className="text-[#0F0F0F]">Owner Match (automatic):</strong> If the GitHub repo URL belongs to your GitHub account (the one you signed in with), it verifies instantly.
                </li>
                <li>
                  <strong className="text-[#0F0F0F]">Verification File (for collaborators):</strong> Add a file named <code className="bg-white px-1.5 py-0.5 border border-[#E4E4E7] font-mono text-[10px]">.vibetalent</code> to the root of the repo containing your GitHub username. Then click the <strong>Verify</strong> button on the project card below.
                </li>
              </ol>
            </div>
          )}

          {showProjectForm && (
            <div
              className="p-5 mb-4"
              style={{
                backgroundColor: "#FFFFFF",
                border: "2px solid #0F0F0F",
                boxShadow: "var(--shadow-brutal-sm)",
              }}
            >
              <h3 className="text-sm font-extrabold uppercase text-[#0F0F0F] mb-3">{editingProjectId ? "Edit Project" : "New Project"}</h3>
              {projectError && (
                <div className="p-3 mb-3 text-sm font-bold text-[#991B1B]" style={{ backgroundColor: "#FEE2E2", border: "2px solid #0F0F0F" }}>
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
                    placeholder="Live URL"
                    value={projectForm.live_url}
                    onChange={(e) => setProjectForm({ ...projectForm, live_url: e.target.value })}
                    className="input-brutal"
                  />
                  <input
                    type="text"
                    placeholder="GitHub URL"
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
                  <label className="text-xs font-bold uppercase tracking-wide text-[#71717A] mb-1.5 block">Project Screenshot</label>
                  <div className="flex items-center gap-4">
                    {projectImagePreview && (
                      <div className="relative w-24 h-16 border-2 border-[#0F0F0F]">
                        <Image src={projectImagePreview} alt="Preview" fill className="object-cover" />
                        <button onClick={() => { setProjectImageFile(null); setProjectImagePreview(null); }} className="absolute -top-2 -right-2 w-5 h-5 bg-[#0F0F0F] text-white rounded-full flex items-center justify-center text-xs">&times;</button>
                      </div>
                    )}
                    <button type="button" onClick={() => projectImageInputRef.current?.click()} className="btn-brutal btn-brutal-secondary text-xs py-1.5 px-3">
                      <Camera size={14} className="mr-1 inline" /> {projectImagePreview ? "Change" : "Add Image"}
                    </button>
                    <input ref={projectImageInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleProjectImageSelect} className="hidden" />
                  </div>
                  <p className="text-xs text-[#71717A] mt-1">Recommended: 1280×720px (16:9). Max 5MB. JPG, PNG, WebP, GIF.</p>
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

          <div className="space-y-4">
            {user.projects.map((project) => (
              <div key={project.id}>
                <ProjectCard
                  project={project}
                  onEdit={handleStartEdit}
                  verified={!!project.verified}
                  onVerify={verifyProject}
                />
                {verifyingProjectId === project.id && (
                  <div className="mt-1 px-5 py-2 text-xs font-bold text-[#71717A] uppercase">
                    Verifying...
                  </div>
                )}
                {verifyMessage && verifyMessage.projectId === project.id && (
                  <div className={`mt-1 px-5 py-2 text-xs font-bold uppercase ${verifyMessage.success ? "text-green-600" : "text-orange-600"}`}>
                    {verifyMessage.text}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      </>
      )}

      {activeTab === "inbox" && (
        <div>
          <h2 className="text-lg font-extrabold uppercase text-[#0F0F0F] mb-4 flex items-center gap-2">
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
                backgroundColor: "#FFFFFF",
                border: "2px solid #0F0F0F",
                boxShadow: "var(--shadow-brutal)",
              }}
            >
              <Inbox size={48} className="mx-auto text-[#D4D4D8] mb-4" />
              <h3 className="text-lg font-extrabold uppercase text-[#0F0F0F]">No hire requests yet</h3>
              <p className="text-sm text-[#52525B] font-medium mt-2">
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
                    backgroundColor: request.status === "new" ? "#FFFBEB" : "#FFFFFF",
                    border: "2px solid #0F0F0F",
                    boxShadow: "var(--shadow-brutal-sm)",
                  }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-base font-extrabold text-[#0F0F0F]">
                          {request.sender_name}
                        </h3>
                        <span
                          className="px-2.5 py-0.5 text-xs font-extrabold uppercase"
                          style={{
                            backgroundColor:
                              request.status === "new"
                                ? "var(--accent)"
                                : request.status === "read"
                                ? "#E4E4E7"
                                : "#D1FAE5",
                            color:
                              request.status === "new"
                                ? "#FFFFFF"
                                : request.status === "read"
                                ? "#52525B"
                                : "#065F46",
                            border: "2px solid #0F0F0F",
                          }}
                        >
                          {request.status}
                        </span>
                      </div>
                      <p className="text-sm text-[#52525B] font-medium mt-0.5">
                        {request.sender_email}
                      </p>

                      {request.budget && (
                        <div className="flex items-center gap-1.5 mt-2">
                          <DollarSign size={14} className="text-[var(--accent)]" />
                          <span className="text-sm font-bold text-[#0F0F0F]">{request.budget}</span>
                        </div>
                      )}

                      <p className="text-sm text-[#3F3F46] mt-3 whitespace-pre-wrap">
                        {request.message}
                      </p>

                      <p className="text-xs text-[#A1A1AA] font-bold uppercase mt-3">
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
                          backgroundColor: replyingTo === request.id ? "#0F0F0F" : "var(--accent)",
                          color: "#FFFFFF",
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
                            style={{ backgroundColor: "#DC2626", color: "#FFFFFF" }}
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
                          style={{ backgroundColor: "#FEE2E2", color: "#991B1B" }}
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
                        border: "2px solid #0F0F0F",
                      }}
                    >
                      {/* Messages area */}
                      <div
                        style={{
                          backgroundColor: "#FAFAFA",
                          maxHeight: "400px",
                          overflowY: "auto",
                        }}
                      >
                        <div className="p-4 space-y-3">
                          {loadingChat === request.id ? (
                            <div className="text-center py-8">
                              <p className="text-sm text-[#71717A] font-medium">Loading messages...</p>
                            </div>
                          ) : (
                            <>
                              {/* Original message as first "message" */}
                              <div className="flex justify-start">
                                <div className="max-w-[80%]">
                                  <div className="flex items-center gap-2 mb-1">
                                    <User size={12} className="text-[#71717A]" />
                                    <span className="text-xs font-bold uppercase text-[#71717A]">
                                      {request.sender_name}
                                    </span>
                                  </div>
                                  <div
                                    className="p-3"
                                    style={{
                                      backgroundColor: "#FFFFFF",
                                      border: "2px solid #0F0F0F",
                                      boxShadow: "2px 2px 0 #000",
                                    }}
                                  >
                                    <p className="text-sm text-[#3F3F46] whitespace-pre-wrap">
                                      {request.message}
                                    </p>
                                  </div>
                                  <p className="text-xs text-[#A1A1AA] mt-1">
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
                                          <User size={12} className="text-[#71717A]" />
                                        )}
                                        <span className="text-xs font-bold uppercase text-[#71717A]">
                                          {isBuilder ? "You" : request.sender_name}
                                        </span>
                                      </div>
                                      <div
                                        className="p-3"
                                        style={{
                                          backgroundColor: isBuilder ? "var(--accent)" : "#FFFFFF",
                                          color: isBuilder ? "#FFFFFF" : "#3F3F46",
                                          border: "2px solid #0F0F0F",
                                          boxShadow: "2px 2px 0 #000",
                                        }}
                                      >
                                        <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                                      </div>
                                      <p
                                        className={`text-xs text-[#A1A1AA] mt-1 ${
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
                                  <p className="text-xs text-[#A1A1AA] font-medium">
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
                          backgroundColor: "#FFFFFF",
                          borderTop: "2px solid #0F0F0F",
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
                            color: "#FFFFFF",
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
