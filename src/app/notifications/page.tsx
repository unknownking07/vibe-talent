"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Notification } from "@/lib/types/database";
import { NotificationsView } from "@/components/notifications/notifications-view";

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    // Fetch immediately on mount. We skip a separate client-side
    // supabase.auth.getUser() round-trip (it only gated the redirect and is
    // redundant — the API enforces auth itself) and act on the API's 401.
    // This removes a full Supabase Auth round-trip from the critical path.
    let cancelled = false;
    fetch("/api/notifications")
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 401) {
          // The login page reads `?redirect=` (not `?next=`) to decide where to
          // send the user back after sign-in. `replace` so the bounced-through
          // page doesn't linger in history. Leave loading=true so the redirect
          // doesn't flash the empty state.
          router.replace("/auth/login?redirect=/notifications");
          return;
        }
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setNotifications(data.data || []);
        }
        if (!cancelled) setLoading(false);
      })
      .catch(() => {
        // Network drop / transient error — render the empty state.
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleMarkAllRead = async () => {
    if (notifications.every((n) => n.read)) return;
    setMarking(true);
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mark_all: true }),
      });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
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
    const previousRead = notifications.find((n) => n.id === id)?.read ?? false;
    if (previousRead) return; // already read — nothing to do
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    const revert = () =>
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: previousRead } : n)));
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

  return (
    <NotificationsView
      notifications={notifications}
      loading={loading}
      marking={marking}
      onMarkRead={handleMarkRead}
      onMarkAllRead={handleMarkAllRead}
    />
  );
}
