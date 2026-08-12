"use client";

import { useState } from "react";
import type { Notification } from "@/lib/types/database";
import { NotificationsView } from "@/components/notifications/notifications-view";

/**
 * Interactive shell for /notifications.
 *
 * The list itself is fetched on the server (see page.tsx) and handed over as
 * `initialNotifications`, so this component renders real rows on first paint.
 * It used to fetch on mount, which serialised four steps before anything
 * appeared: route JS -> hydrate -> effect -> API round trip (and that round
 * trip itself paid an auth.getUser() hop to Supabase before it could query).
 * Only the mark-read writes stay on the client.
 */
export function NotificationsClient({
  initialNotifications,
}: {
  initialNotifications: Notification[];
}) {
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const [marking, setMarking] = useState(false);

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
    if (previousRead) return; // already read: nothing to do
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
      loading={false}
      marking={marking}
      onMarkRead={handleMarkRead}
      onMarkAllRead={handleMarkAllRead}
    />
  );
}
