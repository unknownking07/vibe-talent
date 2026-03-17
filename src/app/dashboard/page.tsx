"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchStreakLogs } from "@/lib/supabase/queries";
import { BadgeDisplay } from "@/components/ui/badge-display";
import type { UserWithSocials } from "@/lib/types/database";
import { StreakCounter } from "@/components/ui/streak-counter";
import { VibeScore } from "@/components/ui/vibe-score";
import { ActivityHeatmap } from "@/components/ui/activity-heatmap";
import { ProjectCard } from "@/components/ui/project-card";
import { fetchHireRequests } from "@/lib/supabase/queries";
import type { HireRequest } from "@/lib/types/database";
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
} from "lucide-react";

export default function DashboardPage() {
  const [user, setUser] = useState<UserWithSocials | null>(null);
  const [heatmapData, setHeatmapData] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) { setLoading(false); return; }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      const { data: profile } = await sb.from("users").select("*").eq("id", authUser.id).single();
      if (!profile) {
        // User hasn't set up profile yet — redirect
        window.location.href = "/auth/profile-setup";
        return;
      }

      const { data: projects } = await sb.from("projects").select("*").eq("user_id", authUser.id).order("created_at", { ascending: false });
      const { data: socials } = await sb.from("social_links").select("*").eq("user_id", authUser.id).single();

      const streakData = await fetchStreakLogs(authUser.id);
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

      // Sync DB if streak was wrong
      if (actualStreak !== profile.streak || actualLongest !== profile.longest_streak) {
        await sb.from("users").update({
          streak: actualStreak,
          longest_streak: actualLongest,
          vibe_score: (actualStreak * 2) + ((projects || []).length * 5),
        }).eq("id", authUser.id);
      }

      setUser({
        ...profile,
        streak: actualStreak,
        longest_streak: actualLongest,
        vibe_score: (actualStreak * 2) + ((projects || []).length * 5),
        projects: projects || [],
        social_links: socials || null,
      });

      setLoading(false);
    }
    loadUser();
  }, []);

  const [showProjectForm, setShowProjectForm] = useState(false);
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
    farcaster: "",
  });

  useEffect(() => {
    if (user) {
      setProfileForm({
        username: user.username,
        bio: user.bio || "",
        twitter: user.social_links?.twitter || "",
        github: user.social_links?.github || "",
        telegram: user.social_links?.telegram || "",
        website: user.social_links?.website || "",
        farcaster: user.social_links?.farcaster || "",
      });
    }
  }, [user]);

  const [todayLogged, setTodayLogged] = useState(false);
  const [logging, setLogging] = useState(false);
  const [countdown, setCountdown] = useState("");
  const [saving, setSaving] = useState(false);
  const [addingProject, setAddingProject] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "inbox">("overview");
  const [hireRequests, setHireRequests] = useState<HireRequest[]>([]);
  const [loadingInbox, setLoadingInbox] = useState(false);

  // Load inbox when tab switches to inbox
  const loadInbox = async () => {
    setLoadingInbox(true);
    const data = await fetchHireRequests();
    setHireRequests(data);
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
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setCountdown(`${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`);
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [todayLogged]);

  const reloadUser = async () => {
    const supabase = createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const { data: profile } = await sb.from("users").select("*").eq("id", authUser.id).single();
    if (!profile) return;
    const { data: projects } = await sb.from("projects").select("*").eq("user_id", authUser.id).order("created_at", { ascending: false });
    const { data: socials } = await sb.from("social_links").select("*").eq("user_id", authUser.id).single();
    setUser({ ...profile, projects: projects || [], social_links: socials || null });
    const streakData = await fetchStreakLogs(authUser.id);
    setHeatmapData(streakData);
  };

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
    await sb.from("users").update({
      streak: newStreak,
      longest_streak: newLongest,
      vibe_score: (newStreak * 2) + (user.projects.length * 5),
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

    // Upsert social links
    await sb.from("social_links").upsert({
      user_id: user.id,
      twitter: profileForm.twitter || null,
      github: profileForm.github || null,
      telegram: profileForm.telegram || null,
      website: profileForm.website || null,
      farcaster: profileForm.farcaster || null,
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
        farcaster: profileForm.farcaster || null,
      },
    });
    setSaving(false);
  };

  const handleAddProject = async () => {
    if (!user || addingProject || !projectForm.title || !projectForm.description) return;
    setAddingProject(true);
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;

    const { error } = await sb.from("projects").insert({
      user_id: user.id,
      title: projectForm.title,
      description: projectForm.description,
      tech_stack: projectForm.tech_stack ? projectForm.tech_stack.split(",").map((t: string) => t.trim()).filter(Boolean) : [],
      live_url: projectForm.live_url || null,
      github_url: projectForm.github_url || null,
      build_time: projectForm.build_time || null,
      tags: projectForm.tags ? projectForm.tags.split(",").map((t: string) => t.trim()).filter(Boolean) : [],
    });

    if (error) {
      console.error("Failed to add project:", error);
      setAddingProject(false);
      return;
    }

    // DB trigger auto-updates vibe_score — reload to get fresh data
    await reloadUser();
    setProjectForm({ title: "", description: "", tech_stack: "", live_url: "", github_url: "", build_time: "", tags: "" });
    setShowProjectForm(false);
    setAddingProject(false);
  };

  const handleStartEdit = (project: import("@/lib/types/database").Project) => {
    setEditingProjectId(project.id);
    setProjectForm({
      title: project.title,
      description: project.description || "",
      tech_stack: project.tech_stack?.join(", ") || "",
      live_url: project.live_url || "",
      github_url: project.github_url || "",
      build_time: project.build_time || "",
      tags: project.tags?.join(", ") || "",
    });
    setShowProjectForm(true);
  };

  const handleSaveEdit = async () => {
    if (!user || !editingProjectId || savingEdit || !projectForm.title || !projectForm.description) return;
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

    await reloadUser();
    setProjectForm({ title: "", description: "", tech_stack: "", live_url: "", github_url: "", build_time: "", tags: "" });
    setShowProjectForm(false);
    setEditingProjectId(null);
    setSavingEdit(false);
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
          <div className="mb-2">
            <VibeScore score={user.vibe_score} size="sm" />
          </div>
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
                <input
                  type="text"
                  value={profileForm.twitter}
                  onChange={(e) => setProfileForm({ ...profileForm, twitter: e.target.value })}
                  placeholder="username"
                  className="input-brutal"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-[#71717A] mb-1.5 block">GitHub</label>
                <input
                  type="text"
                  value={profileForm.github}
                  onChange={(e) => setProfileForm({ ...profileForm, github: e.target.value })}
                  placeholder="username"
                  className="input-brutal"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-[#71717A] mb-1.5 block">Telegram</label>
                <input
                  type="text"
                  value={profileForm.telegram}
                  onChange={(e) => setProfileForm({ ...profileForm, telegram: e.target.value })}
                  placeholder="username"
                  className="input-brutal"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-[#71717A] mb-1.5 block">Website</label>
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
              <label className="text-xs font-bold uppercase tracking-wide text-[#71717A] mb-1.5 block">Farcaster</label>
              <input
                type="text"
                value={profileForm.farcaster}
                onChange={(e) => setProfileForm({ ...profileForm, farcaster: e.target.value })}
                placeholder="username"
                className="input-brutal"
              />
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
              <ProjectCard key={project.id} project={project} onEdit={handleStartEdit} />
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

                    {request.status === "new" && (
                      <button
                        onClick={() => handleMarkAsRead(request.id)}
                        className="btn-brutal btn-brutal-secondary text-xs py-2 px-3 flex items-center gap-1.5 shrink-0"
                      >
                        <MailOpen size={14} />
                        Mark as Read
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
