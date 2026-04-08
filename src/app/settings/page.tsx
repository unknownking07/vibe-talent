"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import type { UserWithSocials } from "@/lib/types/database";
import { EmailPreferences } from "@/components/dashboard/email-preferences";
import {
  Save,
  Camera,
  Users,
  Github,
  CheckCircle2,
} from "lucide-react";

/**
 * Extract a bare username from a value that might be a full URL or @-prefixed handle.
 */
function extractUsername(value: string, platform: "twitter" | "telegram"): string {
  let v = value.trim();
  if (!v) return "";
  v = v.replace(/\/+$/, "");
  const patterns: Record<string, RegExp[]> = {
    twitter: [/^https?:\/\/(www\.)?(twitter|x)\.com\//i],
    telegram: [/^https?:\/\/(www\.)?(t\.me|telegram\.me)\//i],
  };
  for (const re of patterns[platform]) {
    v = v.replace(re, "");
  }
  v = v.replace(/^@/, "");
  v = v.split(/[?#]/)[0];
  v = v.split("/")[0];
  v = v.trim();
  return v;
}

export default function SettingsPage() {
  const [user, setUser] = useState<UserWithSocials | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [referralCopied, setReferralCopied] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [profileForm, setProfileForm] = useState({
    username: "",
    display_name: "",
    bio: "",
    twitter: "",
    telegram: "",
    website: "",
    ide: "",
  });
  const [connectingGithub, setConnectingGithub] = useState(false);
  const [highlightName, setHighlightName] = useState(false);
  const displayNameRef = useRef<HTMLInputElement>(null);

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
        const results = await Promise.allSettled([
          sb.from("users").select("*").eq("id", authUser.id).single(),
          sb.from("projects").select("*").eq("user_id", authUser.id).order("created_at", { ascending: false }),
          sb.from("social_links").select("*").eq("user_id", authUser.id).single(),
        ]);

        const profile = results[0].status === "fulfilled" ? results[0].value?.data : null;
        const projects = results[1].status === "fulfilled" ? results[1].value?.data : [];
        const socials = results[2].status === "fulfilled" ? results[2].value?.data : null;

        if (!profile) {
          window.location.href = "/auth/profile-setup";
          return;
        }

        setUser({
          ...profile,
          projects: projects || [],
          social_links: socials || null,
        });
      } catch (err) {
        console.error("Settings loadUserData failed:", err);
      } finally {
        setLoading(false);
      }
    }

    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      if (cancelled) return;
      if (authUser) {
        loadUserData(authUser);
      } else {
        window.location.href = "/auth/login";
      }
    });

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

  // Populate form when user loads
  useEffect(() => {
    if (user) {
      setProfileForm({
        username: user.username,
        display_name: user.display_name || "",
        bio: user.bio || "",
        twitter: user.social_links?.twitter || "",
        telegram: user.social_links?.telegram || "",
        website: user.social_links?.website || "",
        ide: user.social_links?.farcaster || "",
      });
    }
  }, [user]);

  // When arriving via ?complete=name (e.g. from the navbar onboarding dot),
  // scroll to the display name field and pulse it until the user starts typing.
  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("complete") === "name" && !user.display_name) {
      setHighlightName(true);
      // Defer until after the form fields have mounted
      setTimeout(() => {
        displayNameRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        displayNameRef.current?.focus();
      }, 120);
    }
  }, [user]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      alert('Only JPG, PNG, WebP, and GIF images are allowed');
      return;
    }

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

    const { error: uploadError } = await sb.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      console.error("Upload failed:", uploadError);
      setUploadingAvatar(false);
      return;
    }

    const { data: { publicUrl } } = sb.storage
      .from("avatars")
      .getPublicUrl(filePath);

    const avatarUrl = `${publicUrl}?t=${Date.now()}`;

    await sb.from("users").update({ avatar_url: avatarUrl }).eq("id", user.id);
    setUser({ ...user, avatar_url: avatarUrl });
    setUploadingAvatar(false);
  };

  const handleSaveProfile = async () => {
    if (!user || saving) return;
    const twitter = profileForm.twitter.trim();
    const telegram = profileForm.telegram.trim();
    if (!twitter && !telegram) {
      alert("Please add your X (Twitter) or Telegram so clients can contact you.");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;

    const trimmedDisplayName = profileForm.display_name.trim();
    await sb
      .from("users")
      .update({
        username: profileForm.username.trim(),
        display_name: trimmedDisplayName || null,
        bio: profileForm.bio.trim(),
      })
      .eq("id", user.id);

    // Preserve the verified GitHub handle — it's only set via OAuth linking,
    // never from a free-text field on this page.
    const verifiedGithub = user.github_username || user.social_links?.github || null;

    await sb.from("social_links").upsert({
      user_id: user.id,
      twitter: twitter || null,
      github: verifiedGithub,
      telegram: telegram || null,
      website: profileForm.website.trim() || null,
      farcaster: profileForm.ide || null,
    }, { onConflict: "user_id" });

    setUser({
      ...user,
      username: profileForm.username,
      display_name: trimmedDisplayName || null,
      bio: profileForm.bio,
      social_links: {
        id: user.social_links?.id || "",
        user_id: user.id,
        twitter: profileForm.twitter || null,
        github: verifiedGithub,
        telegram: profileForm.telegram || null,
        website: profileForm.website || null,
        farcaster: profileForm.ide || null,
      },
    });
    setSaving(false);
  };

  const handleConnectGithub = async () => {
    setConnectingGithub(true);
    const supabase = createClient();
    const { error } = await supabase.auth.linkIdentity({
      provider: "github",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/settings` },
    });
    if (error) {
      alert(`Couldn't connect GitHub: ${error.message}`);
      setConnectingGithub(false);
    }
    // On success the browser redirects to GitHub, so no further UI update needed.
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12">
        <h1 className="text-3xl font-extrabold uppercase text-[var(--foreground)] mb-8">Settings</h1>
        <div className="space-y-6">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-32" />)}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12 text-center">
        <h1 className="text-3xl font-extrabold uppercase text-[var(--foreground)] mb-4">Settings</h1>
        <p className="text-[var(--text-secondary)] font-medium">Please sign in to view your settings.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12">
      <h1 className="text-3xl font-extrabold uppercase text-[var(--foreground)] mb-8">Settings</h1>

      {/* Edit Profile */}
      <div
        className="p-6 mb-8"
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "2px solid var(--border-hard)",
          boxShadow: "var(--shadow-brutal)",
        }}
      >
        <h2 className="text-lg font-extrabold uppercase text-[var(--foreground)] mb-4">Edit Profile</h2>
        <div className="space-y-4">
          {/* Avatar Upload */}
          <div className="flex items-center gap-4">
            <div
              className="relative w-20 h-20 flex items-center justify-center text-2xl font-extrabold text-white cursor-pointer group"
              style={{ backgroundColor: "var(--bg-inverted)", border: "2px solid var(--border-hard)" }}
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
              <p className="text-xs text-[var(--text-muted)] mt-1">JPG, PNG. Max 2MB.</p>
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
            <label className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-1.5 block">Username</label>
            <input
              type="text"
              value={profileForm.username}
              onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })}
              className="input-brutal"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-1.5 flex items-center gap-2">
              Display Name
              {highlightName && (
                <span
                  className="px-1.5 py-0.5 text-[10px] font-extrabold text-white uppercase"
                  style={{ backgroundColor: "var(--accent)", border: "1px solid var(--border-hard)" }}
                >
                  New
                </span>
              )}
            </label>
            <input
              ref={displayNameRef}
              type="text"
              value={profileForm.display_name}
              onChange={(e) => {
                setProfileForm({ ...profileForm, display_name: e.target.value });
                if (highlightName) setHighlightName(false);
              }}
              placeholder="Your full name (e.g. Abhinav Kumar)"
              maxLength={50}
              className={`input-brutal ${highlightName ? "settings-highlight-pulse" : ""}`}
              style={highlightName ? { outline: "3px solid var(--accent)", outlineOffset: 2 } : undefined}
            />
            <p className="mt-1.5 text-xs font-medium text-[var(--text-muted)]">
              {highlightName
                ? "Add your full name so employers know who you are."
                : "Shown above your @username on your profile and in search results."}
            </p>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-1.5 block">Bio</label>
            <textarea
              value={profileForm.bio}
              onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
              rows={3}
              className="input-brutal resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-1.5 block">X (Twitter)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted-soft)] font-bold text-sm select-none">@</span>
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
              <label className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-1.5 block">GitHub</label>
              {user.github_username ? (
                <div
                  className="flex items-center gap-2 px-3 py-2.5 text-sm"
                  style={{
                    backgroundColor: "var(--status-success-bg)",
                    border: "2px solid var(--border-hard)",
                  }}
                >
                  <CheckCircle2 size={16} className="text-[var(--status-success-text)] flex-shrink-0" />
                  <span className="font-bold text-[var(--status-success-text)]">@{user.github_username}</span>
                  <span className="text-xs font-bold uppercase text-[var(--status-success-text)] opacity-70 ml-auto">Verified</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleConnectGithub}
                  disabled={connectingGithub}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-extrabold uppercase tracking-wide text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:bg-[var(--bg-pill-hover)]"
                  style={{
                    backgroundColor: "var(--bg-inverted)",
                    border: "2px solid var(--border-hard)",
                  }}
                >
                  <Github size={16} />
                  {connectingGithub ? "Connecting..." : "Connect GitHub"}
                </button>
              )}
              <p className="mt-1.5 text-xs font-medium text-[var(--text-muted)]">
                {user.github_username
                  ? "Ownership verified via GitHub OAuth."
                  : "Verify ownership to enable streak sync."}
              </p>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-1.5 block">Telegram</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted-soft)] font-bold text-sm select-none">@</span>
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
              <label className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-1.5 block">Portfolio</label>
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
            <label className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-1.5 block">Vibe Coding IDE</label>
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

      {/* Email Notifications */}
      <div className="mb-8">
        <EmailPreferences />
      </div>

      {/* Referral */}
      <div
        id="referral"
        className="p-6 mb-8"
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "2px solid var(--border-hard)",
          boxShadow: "var(--shadow-brutal)",
        }}
      >
        <h2 className="text-lg font-extrabold uppercase flex items-center gap-2 text-[var(--foreground)] mb-2">
          <Users size={20} className="text-[var(--accent)]" />
          Invite Builders
        </h2>
        <p className="text-sm text-[var(--text-secondary)] font-medium mb-4">
          Share your referral link. When someone signs up, you get a bonus streak day!
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            readOnly
            value={`${typeof window !== "undefined" ? window.location.origin : "https://www.vibetalent.work"}/auth/signup?ref=${user.username}`}
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
              color: referralCopied ? "#065F46" : "var(--bg-surface)",
            }}
          >
            {referralCopied ? "Copied!" : "Copy"}
          </button>
        </div>
        {(user.referral_count ?? 0) > 0 && (
          <p className="text-sm font-bold text-[var(--foreground)] mt-3">
            You&apos;ve referred {user.referral_count} builder{user.referral_count !== 1 ? "s" : ""}!
          </p>
        )}
      </div>

    </div>
  );
}
