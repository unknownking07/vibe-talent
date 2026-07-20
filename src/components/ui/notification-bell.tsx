"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Notification } from "@/lib/types/database";
import { NOTIFICATION_ICONS, notificationTimeAgo, extractNotificationAvatar } from "@/lib/notification-display";

// JetBrains Mono is loaded as a CSS var by the root layout; fall back gracefully.
const MONO = "var(--font-jetbrains-mono), 'JetBrains Mono', monospace";

/** Compact (34px) version of the notifications-page chip: avatar with a type
 *  badge when present, otherwise a bordered type icon. Read items mute. */
function BellChip({ n }: { n: Notification }) {
  const Icon = NOTIFICATION_ICONS[n.type] || Bell;
  const avatar = extractNotificationAvatar(n.metadata as Record<string, unknown> | null);
  const read = n.read;
  const ring = read ? "var(--border-subtle)" : "var(--border-hard)";

  if (avatar) {
    return (
      <div style={{ position: "relative", width: 34, height: 34, flexShrink: 0 }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- free-form metadata URL; plain img avoids next/image remote-host config */}
        <img
          src={avatar}
          alt=""
          width={34}
          height={34}
          style={{
            display: "block",
            width: 34,
            height: 34,
            objectFit: "cover",
            border: `2px solid ${ring}`,
            filter: read ? "grayscale(1) opacity(0.7)" : "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: -5,
            bottom: -5,
            width: 16,
            height: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: read ? "var(--bg-surface-light)" : "var(--accent)",
            border: `1.5px solid ${ring}`,
            color: read ? "var(--text-muted-soft)" : "#fff",
          }}
        >
          <Icon size={9} />
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        width: 34,
        height: 34,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: `2px solid ${ring}`,
        color: read ? "var(--text-muted-soft)" : "var(--accent)",
        background: "var(--bg-surface)",
        boxShadow: read ? "none" : "2px 2px 0 var(--border-hard)",
      }}
    >
      <Icon size={16} />
    </div>
  );
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  // False until the first successful list fetch — the dropdown shows a loading
  // hint instead of a false "No notifications yet" while the lazy list loads.
  const [listLoaded, setListLoaded] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // Mirrors `open` for the notifications-updated listener, which is registered
  // once on mount and would otherwise capture the initial value forever.
  // Synced in an effect rather than assigned during render — a render-phase
  // ref write isn't safe under concurrent rendering (react-hooks/refs).
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);
  const router = useRouter();

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.data || []);
      setUnreadCount(data.unread_count || 0);
      setListLoaded(true);
    } catch {
      // Silently fail
    }
  }, []);

  // Lightweight badge-only refresh for the polling loop: skips the notification
  // list (fetched lazily when the dropdown opens) and returns just the count.
  // Reports success so the initial load can schedule a one-shot retry.
  const fetchUnreadCount = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/notifications?count=1");
      if (!res.ok) return false;
      const data = await res.json();
      setUnreadCount(data.unread_count || 0);
      return true;
    } catch {
      return false;
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect -- this effect's setState
     calls all happen after an await/timer boundary (fetch responses, polling
     ticks), not during the effect body, so there's no cascading-render risk. */
  useEffect(() => {
    // Pause polling while the tab is hidden so background tabs don't keep
    // hitting /api/notifications (burning Cloudflare Worker invocations +
    // Supabase egress) for a badge nobody is looking at; resume with an
    // immediate re-sync on focus. Mirrors components/feed/network-feed.
    let interval: ReturnType<typeof setInterval> | null = null;
    const startPolling = () => {
      if (interval !== null) return;
      interval = setInterval(fetchUnreadCount, 60000);
    };
    const stopPolling = () => {
      if (interval === null) return;
      clearInterval(interval);
      interval = null;
    };
    const onVisibilityChange = () => {
      if (typeof document === "undefined") return;
      if (document.hidden) {
        stopPolling();
      } else {
        fetchUnreadCount();
        startPolling();
      }
    };
    // Refresh on external updates (e.g. logging activity clears streak
    // warnings). Badge-only while the dropdown is closed: pulling the 50-row
    // list for a popover nobody has opened would defeat the lazy-list contract
    // below. Reads `open` through a ref so this listener never goes stale.
    const handleRefresh = () => {
      if (openRef.current) {
        void fetchNotifications();
      } else {
        void fetchUnreadCount();
      }
    };

    // Badge-first initial load: one head-count query paints the unread badge
    // as fast as the Worker can auth, instead of waiting on the 50-row list +
    // count the old full fetch pulled. The list stays lazy — opening the
    // dropdown always fetches it fresh (see the bell button), so preloading
    // it here bought latency and egress for nothing. The one-shot retry
    // covers hard loads where the first hit lands while the auth cookie is
    // still settling and 401s.
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    // Cleanup can run while that first request is still in flight; without
    // this flag the continuation would schedule a retry *after* unmount, past
    // the clearTimeout in the cleanup, leaving a stray fetch and a setState on
    // a dead component.
     
    let disposed = false;
    void fetchUnreadCount().then((ok) => {
      if (!ok && !disposed) {
        retryTimer = setTimeout(() => void fetchUnreadCount(), 1500);
      }
    });
    startPolling();
    window.addEventListener("notifications-updated", handleRefresh);
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibilityChange);
    }
    return () => {
      disposed = true;
      stopPolling();
      if (retryTimer !== null) clearTimeout(retryTimer);
      window.removeEventListener("notifications-updated", handleRefresh);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
    };
  }, [fetchNotifications, fetchUnreadCount]);
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
    // Always send users to the dedicated notifications page so they can read
    // the full message — the dropdown truncates long bodies. Deep links from
    // metadata.link still surface there as a per-item CTA.
    router.push("/notifications");
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          // Opening the dropdown: pull the fresh list (the interval only keeps
          // the count current, so the list may be stale or unloaded).
          if (!open) fetchNotifications();
          setOpen((o) => !o);
        }}
        className="relative w-10 h-10 flex items-center justify-center cursor-pointer transition-all hover:translate-x-[1px] hover:translate-y-[1px]"
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "2px solid var(--border-hard)",
          boxShadow: open ? "var(--shadow-brutal-xs)" : "var(--shadow-brutal-sm)",
        }}
        aria-label="Notifications"
        aria-expanded={open}
        aria-controls="notification-popover"
        aria-haspopup="menu"
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
          id="notification-popover"
          role="menu"
          className="fixed right-2 top-16 z-50 w-[min(20rem,calc(100vw-1rem))] max-h-[60vh] sm:absolute sm:right-0 sm:top-12 sm:w-80 sm:max-h-96 overflow-y-auto"
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
              <p className="text-sm font-medium text-[var(--text-muted-soft)]">
                {listLoaded ? "No notifications yet" : "Loading notifications…"}
              </p>
            </div>
          ) : (
            <div>
              {notifications.slice(0, 10).map((n) => (
                <button
                  key={n.id}
                  role="menuitem"
                  onClick={() => handleClickNotification(n)}
                  className={`ntf-row${n.read ? "" : " ntf-row-unread"} w-full text-left px-3.5 py-3 flex gap-3 items-start cursor-pointer`}
                >
                  <BellChip n={n} />
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm leading-tight ${n.read ? "font-semibold text-[var(--text-muted)]" : "font-bold text-[var(--foreground)]"}`}>
                      {n.title}
                    </p>
                    <p className="text-xs mt-0.5 truncate" style={{ color: n.read ? "var(--text-muted-soft)" : "var(--text-secondary)" }}>{n.message}</p>
                    <p className="text-[10px] mt-1.5 font-bold uppercase tracking-wide" style={{ fontFamily: MONO, color: "var(--text-muted-soft)" }}>{notificationTimeAgo(n.created_at)}</p>
                  </div>
                  {!n.read && (
                    <span
                      className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                      style={{ backgroundColor: "var(--accent)", border: "1.5px solid var(--border-hard)" }}
                    />
                  )}
                </button>
              ))}
              <button
                onClick={() => {
                  setOpen(false);
                  router.push("/notifications");
                }}
                className="w-full px-4 py-2.5 text-xs font-extrabold uppercase tracking-wide text-center text-[var(--accent)] border-t-2 border-[var(--border-hard)] hover:bg-[var(--bg-surface-light)] cursor-pointer"
              >
                View all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
