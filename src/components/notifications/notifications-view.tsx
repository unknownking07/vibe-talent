"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Bell, Check } from "@phosphor-icons/react";
import type { Notification } from "@/lib/types/database";
import {
  NOTIFICATION_ICONS,
  NOTIFICATION_TAGS,
  HIRE_NOTIFICATION_TYPES,
  notificationTimeAgo,
  parseNotificationMessage,
  notificationBucket,
  extractNotificationLink,
  extractNotificationAvatar,
  type NotificationBucket,
} from "@/lib/notification-display";

// JetBrains Mono is loaded as a CSS var by the root layout; fall back gracefully.
const MONO = "var(--font-jetbrains-mono), 'JetBrains Mono', monospace";
const HARD = "var(--border-hard)";
const BUCKET_ORDER: NotificationBucket[] = ["Today", "This week", "Earlier"];

type Filter = "all" | "unread" | "hires" | "activity";

/**
 * Avatar-led chip: a person's photo (with a small type badge) when the
 * notification carries one in metadata, otherwise a bordered type icon. Read
 * items mute to a subtle border + grey; unread items get the hard border and
 * accent treatment.
 */
function NotificationChip({ n }: { n: Notification }) {
  const Icon = NOTIFICATION_ICONS[n.type] || Bell;
  const avatar = extractNotificationAvatar(n.metadata as Record<string, unknown> | null);
  const read = n.read;

  if (avatar) {
    return (
      <div style={{ position: "relative", width: 46, height: 46 }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- metadata avatar URL is free-form; plain img avoids next/image remote-host config requirements */}
        <img
          src={avatar}
          alt=""
          width={46}
          height={46}
          style={{
            display: "block",
            width: 46,
            height: 46,
            objectFit: "cover",
            borderRadius: "50%",
            border: `1px solid ${read ? "var(--border-subtle)" : HARD}`,
            filter: read ? "grayscale(1) opacity(0.7)" : "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: -7,
            bottom: -7,
            width: 22,
            height: 22,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 999,
            background: read ? "var(--bg-surface-light)" : "var(--accent)",
            border: `1px solid ${read ? "var(--border-subtle)" : HARD}`,
            color: read ? "var(--text-muted-soft)" : "#fff",
          }}
        >
          <Icon weight="fill" size={12} />
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        width: 44,
        height: 44,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 999,
        border: `1px solid ${read ? "var(--border-subtle)" : HARD}`,
        color: read ? "var(--text-muted-soft)" : "var(--accent)",
        background: "var(--bg-surface)",
        boxShadow: read ? "none" : "var(--shadow-brutal-xs)",
      }}
    >
      <Icon weight="fill" size={20} />
    </div>
  );
}

function NotificationCard({
  n,
  onRead,
}: {
  n: Notification;
  onRead: (id: string) => void;
}) {
  const read = n.read;
  const link = extractNotificationLink(n.metadata as Record<string, unknown> | null);
  const tag = NOTIFICATION_TAGS[n.type] || "Update";

  return (
    <article
      className="ntf-card"
      style={{
        position: "relative",
        display: "flex",
        gap: 14,
        alignItems: "flex-start",
        padding: "16px 18px",
        borderRadius: "var(--radius-card)",
        border: `1px solid ${read ? "var(--border-subtle)" : HARD}`,
        background: read ? "var(--bg-surface)" : "var(--bg-unread)",
        boxShadow: read ? "var(--shadow-brutal-xs)" : "var(--shadow-brutal-sm)",
      }}
    >
      <div style={{ position: "relative", flexShrink: 0 }}>
        <NotificationChip n={n} />
      </div>

      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <h2
            style={{
              margin: 0,
              fontSize: 15,
              lineHeight: 1.35,
              fontWeight: read ? 600 : 700,
              color: read ? "var(--text-muted)" : "var(--foreground)",
            }}
          >
            {link ? (
              <Link
                href={link}
                onClick={() => {
                  if (!read) onRead(n.id);
                }}
                className="ntf-stretched-link"
                style={{ color: "inherit", textDecoration: "none" }}
              >
                {n.title}
              </Link>
            ) : (
              n.title
            )}
          </h2>
          {!read && (
            <span
              aria-label="Unread"
              style={{
                marginLeft: "auto",
                flexShrink: 0,
                width: 9,
                height: 9,
                borderRadius: "50%",
                background: "var(--accent)",
                marginTop: 5,
              }}
            />
          )}
        </div>

        <p
          style={{
            margin: "6px 0 0",
            fontSize: 13,
            lineHeight: 1.5,
            color: read ? "var(--text-muted-soft)" : "var(--text-secondary)",
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
          }}
        >
          {/* @mentions become profile links. `position: relative; z-index: 1`
              lifts them above the title's stretched ::after overlay, which
              covers the whole card — without it the card link swallows the
              click and the mention is unreachable. */}
          {parseNotificationMessage(n.message).map((seg, i) =>
            seg.type === "mention" ? (
              <Link
                key={i}
                href={`/profile/${seg.username}`}
                className="ntf-mention"
                style={{
                  position: "relative",
                  zIndex: 1,
                  color: "var(--accent)",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                @{seg.username}
              </Link>
            ) : (
              <span key={i}>{seg.value}</span>
            )
          )}
        </p>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginTop: 12,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontFamily: MONO,
              fontSize: 10,
              fontWeight: 500,
              color: "var(--text-muted-soft)",
            }}
          >
            {notificationTimeAgo(n.created_at)}
          </span>
          <span
            style={{
              fontFamily: MONO,
              fontSize: 10,
              fontWeight: 500,
              padding: "2px 8px",
              borderRadius: 999,
              border: `1px solid ${read ? "var(--border-subtle)" : HARD}`,
              color: read ? "var(--text-muted-soft)" : "var(--text-muted)",
            }}
          >
            {tag}
          </span>
          {!read && (
            <button
              onClick={() => onRead(n.id)}
              style={{
                position: "relative",
                zIndex: 1,
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 11,
                fontWeight: 600,
                color: "var(--text-muted)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
              }}
            >
              <Check weight="bold" size={12} />
              Mark read
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

/**
 * Presentational notifications screen: header, filter tabs, time-bucketed
 * groups, and read/unread cards. Pure — it owns only the active-filter UI
 * state; data fetching, auth, and the mark-read/all network calls are supplied
 * by the caller (the route page, or the dev preview harness).
 */
export function NotificationsView({
  notifications,
  loading = false,
  marking = false,
  onMarkRead,
  onMarkAllRead,
}: {
  notifications: Notification[];
  loading?: boolean;
  marking?: boolean;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");

  const unreadCount = notifications.filter((n) => !n.read).length;
  const hireCount = notifications.filter((n) => HIRE_NOTIFICATION_TYPES.has(n.type)).length;
  const activityCount = notifications.length - hireCount;

  const tabs: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: "All", count: notifications.length },
    { id: "unread", label: "Unread", count: unreadCount },
    { id: "hires", label: "Hires", count: hireCount },
    { id: "activity", label: "Activity", count: activityCount },
  ];

  const matchesFilter = (n: Notification) => {
    if (filter === "unread") return !n.read;
    if (filter === "hires") return HIRE_NOTIFICATION_TYPES.has(n.type);
    if (filter === "activity") return !HIRE_NOTIFICATION_TYPES.has(n.type);
    return true;
  };
  const filtered = notifications.filter(matchesFilter);

  const groups = (() => {
    const map: Record<NotificationBucket, Notification[]> = {
      Today: [],
      "This week": [],
      Earlier: [],
    };
    for (const n of filtered) map[notificationBucket(n.created_at)].push(n);
    return BUCKET_ORDER.map((label) => ({ label, items: map[label] })).filter(
      (g) => g.items.length > 0
    );
  })();

  const statusLine =
    unreadCount > 0
      ? `${unreadCount} unread`
      : notifications.length > 0
        ? "All caught up"
        : "Nothing yet";

  const surfaceCard = {
    background: "var(--bg-surface)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "var(--radius-card)",
    boxShadow: "var(--shadow-brutal-sm)",
  } as const;

  return (
    <div className="min-h-screen">
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 16px 80px" }}>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-muted)] hover:text-[var(--foreground)] no-underline"
          style={{ marginBottom: 22 }}
        >
          <ArrowLeft size={14} strokeWidth={2.5} />
          Back to dashboard
        </Link>

        {/* HEADER */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            padding: "20px 22px",
            marginBottom: 18,
            ...surfaceCard,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
            <div
              style={{
                width: 46,
                height: 46,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 999,
                background: "var(--accent)",
                boxShadow: "var(--shadow-brutal-accent)",
                color: "#fff",
                flexShrink: 0,
              }}
            >
              <Bell weight="fill" size={22} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h1
                style={{
                  margin: 0,
                  fontSize: 26,
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  lineHeight: 1,
                  color: "var(--foreground)",
                }}
              >
                Notifications
              </h1>
              <p
                style={{
                  margin: "6px 0 0",
                  fontFamily: MONO,
                  fontSize: 11,
                  fontWeight: 500,
                  color: "var(--text-muted)",
                }}
              >
                {statusLine}
              </p>
            </div>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={onMarkAllRead}
              disabled={marking}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                flexShrink: 0,
                padding: "10px 15px",
                fontSize: 12,
                fontWeight: 600,
                color: "#fff",
                background: "var(--accent)",
                border: "none",
                borderRadius: "var(--radius-control)",
                boxShadow: "var(--shadow-brutal-accent)",
                cursor: marking ? "default" : "pointer",
                opacity: marking ? 0.5 : 1,
              }}
            >
              <Check weight="bold" size={14} />
              Mark all read
            </button>
          )}
        </div>

        {/* FILTERS */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
          {tabs.map((t) => {
            const active = filter === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setFilter(t.id)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "9px 15px",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  borderRadius: 999,
                  border: `1px solid ${active ? "var(--foreground)" : "var(--border-subtle)"}`,
                  background: active ? "var(--foreground)" : "var(--bg-surface)",
                  color: active ? "var(--background)" : "var(--foreground)",
                  boxShadow: active ? "none" : "var(--shadow-brutal-xs)",
                  transition: "all 0.12s",
                }}
              >
                {t.label}
                {t.count > 0 && (
                  <span
                    style={{
                      fontFamily: MONO,
                      fontSize: 10,
                      fontWeight: 500,
                      padding: "1px 7px",
                      borderRadius: 999,
                      border: `1px solid ${active ? "var(--background)" : "var(--border-subtle)"}`,
                      color: active ? "var(--background)" : "var(--text-muted)",
                    }}
                  >
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* LIST / STATES */}
        {loading ? (
          <div style={{ padding: "40px 24px", textAlign: "center", ...surfaceCard }}>
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted-soft)" }}>
              Loading notifications…
            </p>
          </div>
        ) : groups.length === 0 ? (
          <div style={{ padding: "56px 24px", textAlign: "center", ...surfaceCard }}>
            <div
              style={{
                width: 56,
                height: 56,
                margin: "0 auto 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 999,
                background: "var(--bg-surface-light)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-muted-soft)",
              }}
            >
              <Bell weight="fill" size={26} />
            </div>
            <p style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 700, color: "var(--foreground)" }}>
              {filter === "unread" ? "No unread notifications" : "No notifications yet"}
            </p>
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
              You&apos;re all caught up. Streak reminders, hire requests, and milestones show up here.
            </p>
          </div>
        ) : (
          <div>
            {groups.map((group) => (
              <div key={group.label} style={{ marginBottom: 26 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <span
                    style={{
                      fontFamily: MONO,
                      fontSize: 11,
                      fontWeight: 500,
                      color: "var(--text-muted-soft)",
                    }}
                  >
                    {group.label}
                  </span>
                  <span style={{ flex: 1, height: 1, background: "var(--border-subtle)" }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {group.items.map((n) => (
                    <NotificationCard key={n.id} n={n} onRead={onMarkRead} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
