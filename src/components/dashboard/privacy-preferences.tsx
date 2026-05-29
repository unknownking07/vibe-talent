"use client";

import { useState, useEffect } from "react";
import { Lock, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/**
 * Single-toggle settings card for "Share private repo activity".
 *
 * Default OFF. When ON, the user's private-repo events appear in the public
 * feed as anonymized rows ("pushed to a private repo") — never with the repo
 * name, URL, or commit message. Quality scores from private repos count
 * toward the public leaderboard rank regardless of this toggle; the toggle
 * only gates *feed visibility*, not score.
 */
export function PrivacyPreferences() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled || !user) {
        setLoading(false);
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from("users")
        .select("share_private_activity")
        .eq("id", user.id)
        .single()
        .then(({ data }: { data: { share_private_activity?: boolean } | null }) => {
          if (cancelled) return;
          setEnabled(Boolean(data?.share_private_activity));
          setLoading(false);
        });
    });
    return () => { cancelled = true; };
  }, []);

  const handleToggle = async () => {
    if (saving) return;
    const next = !enabled;
    const previous = enabled;
    // Optimistic — flip the visual immediately, revert on failure.
    setEnabled(next);
    setSaving(true);
    setSaved(false);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("not signed in");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("users")
        .update({ share_private_activity: next })
        .eq("id", user.id);
      if (error) throw error;
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setEnabled(previous);
    }
    setSaving(false);
  };

  return (
    <div
      className="p-5"
      style={{
        backgroundColor: "var(--bg-surface)",
        border: "2px solid var(--border-hard)",
        boxShadow: "var(--shadow-brutal)",
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-extrabold uppercase flex items-center gap-2 text-[var(--foreground)]">
          <Lock size={16} className="text-[var(--accent)]" />
          Private Repo Privacy
        </h2>
        {saved && (
          <span className="flex items-center gap-1 text-xs font-bold text-emerald-600">
            <Check size={12} /> Saved
          </span>
        )}
      </div>

      <div
        className="flex items-start justify-between gap-3 p-3"
        style={{ border: "1px solid var(--border-subtle)" }}
      >
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-[var(--foreground)]">
            Share private repo activity in the feed
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
            When ON, your private-repo activity shows up in the public feed as
            generic events (e.g. &ldquo;pushed to a private repo&rdquo;). Repo names,
            URLs, commit messages, and file paths are <strong>never</strong> shared.
            When OFF (default), private repos stay completely hidden from the
            feed. Either way, your quality score still counts toward the
            leaderboard.
          </div>
        </div>
        <button
          onClick={handleToggle}
          disabled={saving || loading}
          className="w-10 h-6 rounded-full relative cursor-pointer transition-colors shrink-0 disabled:opacity-50"
          style={{
            backgroundColor: enabled ? "var(--accent)" : "var(--border-subtle)",
            border: "2px solid var(--border-hard)",
          }}
          aria-label="Toggle private repo activity sharing"
          aria-pressed={enabled}
        >
          <span
            className="absolute top-0.5 w-3.5 h-3.5 rounded-full bg-[var(--bg-surface)] transition-all"
            style={{
              left: enabled ? "calc(100% - 18px)" : "2px",
              border: "1px solid var(--border-hard)",
            }}
          />
        </button>
      </div>
    </div>
  );
}
