"use client";

import { useState, useEffect } from "react";
import { Mail, Check } from "lucide-react";

interface Preferences {
  profile_view_digest: boolean;
  streak_reminders: boolean;
  milestone_alerts: boolean;
  weekly_digest: boolean;
  hire_notifications: boolean;
  re_engagement: boolean;
}

const PREF_LABELS: { key: keyof Preferences; label: string; description: string }[] = [
  { key: "profile_view_digest", label: "Profile View Digest", description: "Daily summary of who viewed your profile" },
  { key: "streak_reminders", label: "Streak Reminders", description: "Warnings when your streak is about to end" },
  { key: "milestone_alerts", label: "Milestone Alerts", description: "Notifications for badge and vibe score milestones" },
  { key: "weekly_digest", label: "Weekly Digest", description: "Weekly recap of your stats and activity" },
  { key: "hire_notifications", label: "Hire Notifications", description: "Emails when someone wants to hire you" },
  { key: "re_engagement", label: "Feedback Requests", description: "Occasional emails asking for your feedback if you've been away" },
];

export function EmailPreferences() {
  const [prefs, setPrefs] = useState<Preferences>({
    profile_view_digest: true,
    streak_reminders: true,
    milestone_alerts: true,
    weekly_digest: true,
    hire_notifications: true,
    re_engagement: true,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/email-preferences")
      .then((res) => res.json())
      .then((data) => {
        if (data && !data.error) setPrefs(data);
      })
      .catch(() => {});
  }, []);

  const handleToggle = async (key: keyof Preferences) => {
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    setSaving(true);
    setSaved(false);

    try {
      await fetch("/api/email-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // Revert on error
      setPrefs(prefs);
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
          <Mail size={16} className="text-[var(--accent)]" />
          Email Notifications
        </h2>
        {saved && (
          <span className="flex items-center gap-1 text-xs font-bold text-emerald-600">
            <Check size={12} /> Saved
          </span>
        )}
      </div>

      <div className="space-y-3">
        {PREF_LABELS.map(({ key, label, description }) => (
          <div
            key={key}
            className="flex items-center justify-between p-3"
            style={{ border: "1px solid var(--border-subtle)" }}
          >
            <div className="min-w-0 flex-1 mr-3">
              <div className="text-sm font-bold text-[var(--foreground)]">{label}</div>
              <div className="text-xs text-[var(--text-muted)] mt-0.5">{description}</div>
            </div>
            <button
              onClick={() => handleToggle(key)}
              disabled={saving}
              className="w-10 h-6 rounded-full relative cursor-pointer transition-colors shrink-0"
              style={{
                backgroundColor: prefs[key] ? "var(--accent)" : "var(--border-subtle)",
                border: "2px solid var(--border-hard)",
              }}
              aria-label={`Toggle ${label}`}
            >
              <span
                className="absolute top-0.5 w-3.5 h-3.5 rounded-full bg-[var(--bg-surface)] transition-all"
                style={{
                  left: prefs[key] ? "calc(100% - 18px)" : "2px",
                  border: "1px solid var(--border-hard)",
                }}
              />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
