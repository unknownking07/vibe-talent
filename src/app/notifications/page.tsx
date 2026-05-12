"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, ArrowLeft, ExternalLink, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Notification } from "@/lib/types/database";
import { NOTIFICATION_ICONS, NOTIFICATION_COLORS, notificationTimeAgo, extractNotificationLink } from "@/lib/notification-display";

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [authChecking, setAuthChecking] = useState(true);
  const [marking, setMarking] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.data || []);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth
      .getUser()
      .then(({ data: { user } }) => {
        if (!user) {
          // The login page reads `?redirect=` (not `?next=`) to decide where
          // to send the user after a successful sign-in.
          router.push("/auth/login?redirect=/notifications");
          return;
        }
        setAuthChecking(false);
        fetchNotifications();
      })
      .catch(() => {
        // Treat a getUser rejection (network drop, transient Supabase error)
        // as unauthenticated rather than letting authChecking stall forever.
        router.push("/auth/login?redirect=/notifications");
      });
  }, [fetchNotifications, router]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return;
    setMarking(true);
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mark_all: true }),
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        window.dispatchEvent(new Event("notifications-updated"));
      }
    } catch {
      // Silently fail
    }
    setMarking(false);
  };

  const handleMarkRead = async (id: string) => {
    // Snapshot only the row's prior read state — this page doesn't poll, so a
    // silent server failure would leave the row marked read in the UI while
    // the DB still treated it as unread. Reverting just this row (not the
    // whole list) avoids clobbering concurrent updates from other handlers
    // that may have fired between the optimistic write and the failure.
    const previousRead = notifications.find(n => n.id === id)?.read ?? false;
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));
    const revert = () =>
      setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: previousRead } : n)));
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        revert();
        return;
      }
      window.dispatchEvent(new Event("notifications-updated"));
    } catch {
      revert();
    }
  };

  if (authChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-base)" }}>
        <p className="text-sm font-medium text-[var(--text-muted-soft)]">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-base)" }}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] hover:text-[var(--foreground)] mb-6"
        >
          <ArrowLeft size={14} />
          Back to dashboard
        </Link>

        <div
          className="flex items-center justify-between gap-4 px-5 py-4 mb-6"
          style={{
            backgroundColor: "var(--bg-surface)",
            border: "2px solid var(--border-hard)",
            boxShadow: "var(--shadow-brutal-sm)",
          }}
        >
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-extrabold uppercase tracking-tight text-[var(--foreground)]">
              Notifications
            </h1>
            <p className="text-xs sm:text-sm font-medium text-[var(--text-muted)] mt-0.5">
              {unreadCount > 0
                ? `${unreadCount} unread`
                : notifications.length > 0
                  ? "All caught up"
                  : "Nothing here yet"}
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              disabled={marking}
              className="shrink-0 px-3 py-2 text-xs font-extrabold uppercase tracking-wide text-white cursor-pointer disabled:opacity-50"
              style={{
                backgroundColor: "var(--accent)",
                border: "2px solid var(--border-hard)",
                boxShadow: "var(--shadow-brutal-xs)",
              }}
            >
              Mark all read
            </button>
          )}
        </div>

        {loading ? (
          <div
            className="px-5 py-10 text-center"
            style={{
              backgroundColor: "var(--bg-surface)",
              border: "2px solid var(--border-hard)",
              boxShadow: "var(--shadow-brutal-sm)",
            }}
          >
            <p className="text-sm font-medium text-[var(--text-muted-soft)]">Loading notifications…</p>
          </div>
        ) : notifications.length === 0 ? (
          <div
            className="px-5 py-12 text-center"
            style={{
              backgroundColor: "var(--bg-surface)",
              border: "2px solid var(--border-hard)",
              boxShadow: "var(--shadow-brutal-sm)",
            }}
          >
            <Bell size={32} className="mx-auto mb-3 text-[var(--text-muted-soft)]" />
            <p className="text-base font-bold text-[var(--foreground)] mb-1">No notifications yet</p>
            <p className="text-sm text-[var(--text-muted)]">
              You&apos;ll see streak reminders, hire requests, and milestones here.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {notifications.map((n) => {
              const Icon = NOTIFICATION_ICONS[n.type] || Bell;
              const color = NOTIFICATION_COLORS[n.type] || "var(--text-muted)";
              const link = extractNotificationLink(n.metadata as Record<string, unknown> | null);
              return (
                <article
                  key={n.id}
                  className="px-5 py-4 flex gap-3 sm:gap-4 items-start"
                  style={{
                    backgroundColor: n.read ? "var(--bg-surface)" : "var(--bg-surface-light, var(--bg-surface))",
                    border: "2px solid var(--border-hard)",
                    boxShadow: "var(--shadow-brutal-sm)",
                    borderLeftWidth: 6,
                    borderLeftColor: color,
                  }}
                >
                  <div
                    className="shrink-0 w-9 h-9 flex items-center justify-center"
                    style={{ backgroundColor: `${color}1A`, color }}
                  >
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2 flex-wrap">
                      <h2 className={`text-sm sm:text-base leading-snug ${n.read ? "font-bold text-[var(--text-secondary)]" : "font-extrabold text-[var(--foreground)]"}`}>
                        {n.title}
                      </h2>
                      {!n.read && (
                        <span
                          className="mt-1 inline-block w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: "var(--accent)" }}
                          aria-label="Unread"
                        />
                      )}
                    </div>
                    <p
                      className="text-sm mt-1.5 whitespace-pre-wrap break-words"
                      style={{ color: n.read ? "var(--text-muted)" : "var(--text-secondary)" }}
                    >
                      {n.message}
                    </p>
                    <div className="flex items-center gap-3 mt-3 flex-wrap">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted-soft)]">
                        {notificationTimeAgo(n.created_at)}
                      </span>
                      {link && (
                        <Link
                          href={link}
                          onClick={() => !n.read && handleMarkRead(n.id)}
                          className="inline-flex items-center gap-1 text-xs font-extrabold uppercase tracking-wide text-[var(--accent)] hover:underline"
                        >
                          Open
                          <ExternalLink size={12} />
                        </Link>
                      )}
                      {!n.read && (
                        <button
                          onClick={() => handleMarkRead(n.id)}
                          className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] hover:text-[var(--foreground)] cursor-pointer"
                        >
                          <Check size={12} />
                          Mark read
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
