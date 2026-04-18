"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, Flame, Trophy, CheckCircle, AlertTriangle, Mail, Star, Eye, BarChart3, Zap, LinkIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Notification } from "@/lib/types/database";

const typeIcons: Record<string, typeof Bell> = {
  hire_request: Mail,
  streak_milestone: Flame,
  streak_warning: AlertTriangle,
  badge_earned: Trophy,
  project_verified: CheckCircle,
  project_flagged: AlertTriangle,
  new_review: Star,
  profile_view_summary: Eye,
  weekly_digest: BarChart3,
  vibe_score_milestone: Zap,
  project_missing_links: LinkIcon,
};

const typeColors: Record<string, string> = {
  hire_request: "#FF3A00",
  streak_milestone: "#F59E0B",
  streak_warning: "#EF4444",
  badge_earned: "#8B5CF6",
  project_verified: "#10B981",
  project_flagged: "#EF4444",
  new_review: "#F59E0B",
  profile_view_summary: "#3B82F6",
  weekly_digest: "#6366F1",
  vibe_score_milestone: "#FF3A00",
  project_missing_links: "#F59E0B",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.data || []);
      setUnreadCount(data.unread_count || 0);
    } catch {
      // Silently fail
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    const handleRefresh = () => fetchNotifications();
    window.addEventListener("notifications-updated", handleRefresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener("notifications-updated", handleRefresh);
    };
  }, [fetchNotifications]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleMarkAllRead = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mark_all: true }),
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        setUnreadCount(0);
      }
    } catch {
      // Silently fail
    }
    setLoading(false);
  };

  const handleClickNotification = async (notification: Notification) => {
    if (!notification.read) {
      fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: notification.id }),
      }).catch(() => {});
      setNotifications(prev =>
        prev.map(n => (n.id === notification.id ? { ...n, read: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
    setOpen(false);
    router.push("/dashboard");
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative w-10 h-10 flex items-center justify-center cursor-pointer transition-all hover:translate-x-[1px] hover:translate-y-[1px]"
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "2px solid var(--border-hard)",
          boxShadow: open ? "var(--shadow-brutal-xs)" : "var(--shadow-brutal-sm)",
        }}
        aria-label="Notifications"
      >
        <Bell size={18} className="text-[var(--foreground)]" />
        {unreadCount > 0 && (
          <span
            className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center px-1 text-[10px] font-extrabold text-white rounded-full"
            style={{ backgroundColor: "var(--accent)" }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-12 z-50 w-80 max-h-96 overflow-y-auto"
          style={{
            backgroundColor: "var(--bg-surface)",
            border: "2px solid var(--border-hard)",
            boxShadow: "var(--shadow-brutal-sm)",
          }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b-2 border-[var(--border-hard)]">
            <span className="text-sm font-extrabold uppercase tracking-wide">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                disabled={loading}
                className="text-xs font-bold text-[var(--accent)] hover:underline cursor-pointer"
              >
                Mark all read
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Bell size={24} className="mx-auto mb-2 text-[var(--text-muted-soft)]" />
              <p className="text-sm font-medium text-[var(--text-muted-soft)]">No notifications yet</p>
            </div>
          ) : (
            <div>
              {notifications.map((n) => {
                const Icon = typeIcons[n.type] || Bell;
                const color = typeColors[n.type] || "var(--text-muted)";
                return (
                  <button
                    key={n.id}
                    onClick={() => handleClickNotification(n)}
                    className="w-full text-left px-4 py-3 flex gap-3 items-start transition-colors hover:bg-[var(--bg-surface-light)] cursor-pointer"
                    style={{
                      borderLeft: `3px solid ${color}`,
                      backgroundColor: n.read ? "transparent" : "var(--bg-surface-light, #FFFBEB)",
                    }}
                  >
                    <Icon size={16} style={{ color, marginTop: 2, flexShrink: 0 }} />
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm leading-tight ${n.read ? "font-medium text-[var(--text-secondary)]" : "font-bold text-[var(--foreground)]"}`}>
                        {n.title}
                      </p>
                      <p className="text-xs mt-0.5 truncate" style={{ color: n.read ? "var(--text-muted)" : "var(--text-secondary)" }}>{n.message}</p>
                      <p className="text-[10px] mt-1 font-medium" style={{ color: "var(--text-muted)" }}>{timeAgo(n.created_at)}</p>
                    </div>
                    {!n.read && (
                      <span
                        className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                        style={{ backgroundColor: "var(--accent)" }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
