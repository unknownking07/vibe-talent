"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";


type FeedItem = {
  id: string;
  type: "push" | "pr" | "create" | "issue" | "project" | "streak";
  username: string;
  avatar_url: string | null;
  streak: number;
  date: string;
  repo_name?: string;
  message?: string;
  project_title?: string;
};

type GroupedItem = FeedItem & { count: number };

const GROUP_WINDOW = 4 * 60 * 60 * 1000;

function groupFeedItems(items: FeedItem[]): GroupedItem[] {
  const grouped: GroupedItem[] = [];
  for (const item of items) {
    if (item.type === "project") { grouped.push({ ...item, count: 1 }); continue; }
    const existing = grouped.find(g =>
      g.type === item.type && g.username === item.username && g.repo_name === item.repo_name &&
      g.type !== "project" && Math.abs(new Date(g.date).getTime() - new Date(item.date).getTime()) < GROUP_WINDOW
    );
    if (existing) { existing.count++; }
    else { grouped.push({ ...item, count: 1 }); }
  }
  return grouped;
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}


function actionText(item: GroupedItem): string {
  if (item.type === "project") return "shipped";
  if (item.type === "pr") return item.count > 1 ? `${item.count} PRs` : "PR";
  if (item.type === "create") return "created";
  if (item.type === "streak") return "coded";
  return item.count > 1 ? `${item.count} commits` : "pushed";
}

const AVATAR_COLORS = ["#ff4400", "#4a4a4a", "#ffffff", "#ff4400", "#4a4a4a", "#ffffff"];

export function LiveActivityFeed() {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    function fetchFeed() {
      fetch("/api/feed?limit=20")
        .then((r) => r.json())
        .then((d) => { setFeed(d.feed || []); setLoaded(true); })
        .catch(() => setLoaded(true));
    }
    fetchFeed();
    const interval = setInterval(fetchFeed, 30000);
    return () => clearInterval(interval);
  }, []);

  const grouped = useMemo(() => groupFeedItems(feed).slice(0, 6), [feed]);

  if (!loaded) return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
      <div style={{ textAlign: "center", padding: "20px", color: "var(--text-muted, #8a8a8a)", fontSize: "0.85rem" }}>Loading activity...</div>
    </section>
  );
  if (grouped.length === 0) return null;

  // v2: white text + green blinking dot
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
      <article style={{
        width: "100%",
        maxWidth: 480,
        margin: "0 auto",
        backgroundColor: "var(--bg-surface, #0a0a0a)",
        border: "2px solid var(--border-hard, #fff)",
        boxShadow: "6px 6px 0px #000",
        display: "flex",
        flexDirection: "column",
      }}>
        <header style={{
          backgroundColor: "var(--accent, #ff4400)",
          color: "var(--text-on-inverted, #0F0F0F)",
          padding: "1rem 1.25rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "2px solid var(--border-hard, #fff)",
        }}>
          <div style={{
            fontSize: "1rem",
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "-0.5px",
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontFamily: "var(--font-space-grotesk, 'Space Grotesk', sans-serif)",
          }}>
            <span aria-hidden="true" className="live-dot" />
            Live Activity
          </div>
          <Link href="/feed" style={{
            backgroundColor: "#fff", color: "#000", textDecoration: "none",
            fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase",
            padding: "6px 12px", borderRadius: 999, border: "1.5px solid #000",
            whiteSpace: "nowrap",
          }}>
            View Full Feed
          </Link>
        </header>

        <div style={{ display: "flex", flexDirection: "column", maxHeight: 500, overflowY: "auto" }}>
          {grouped.map((item, idx) => {
            const initials = item.username.slice(0, 2).toUpperCase();
            const bgColor = AVATAR_COLORS[idx % AVATAR_COLORS.length];
            const textColor = bgColor === "#ffffff" ? "#000" : bgColor === "#4a4a4a" ? "#fff" : "#000";
            const name = item.type === "project" ? item.project_title : item.repo_name;

            return (
              <Link
                key={item.id}
                href={`/profile/${item.username}`}
                style={{
                  padding: "1rem 1.25rem",
                  display: "grid",
                  gridTemplateColumns: "auto 1fr",
                  gap: "1rem",
                  borderBottom: idx < grouped.length - 1 ? "1px solid #2a2a2a" : "none",
                  transition: "background-color 0.15s ease",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <div style={{
                  width: 40, height: 40, backgroundColor: bgColor,
                  border: "2px solid var(--border-hard, #fff)",
                  display: "flex", justifyContent: "center", alignItems: "center",
                  fontWeight: 800, color: textColor, fontSize: "1rem",
                  textTransform: "uppercase", boxShadow: "2px 2px 0px #000",
                  overflow: "hidden",
                  fontFamily: "var(--font-space-grotesk, 'Space Grotesk', sans-serif)",
                }}>
                  {item.avatar_url ? (
                    <Image src={item.avatar_url} alt={item.username} width={40} height={40} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : initials}
                </div>

                <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 4 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                    <div style={{ fontSize: "0.875rem", lineHeight: 1.2 }}>
                      <span style={{ fontWeight: 700, color: "var(--foreground, #fff)" }}>@{item.username}</span>{" "}
                      <span style={{ color: "var(--text-muted, #8a8a8a)" }}>{actionText(item)}</span>
                    </div>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted, #8a8a8a)", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                      {relativeTime(item.date)}
                    </span>
                  </div>
                  {name && (
                    <div style={{
                      fontSize: "1rem", fontWeight: 800, fontStyle: "italic",
                      color: "var(--accent, #ff4400)", textTransform: "uppercase",
                      letterSpacing: "-0.5px", lineHeight: 1.1,
                      fontFamily: "var(--font-space-grotesk, 'Space Grotesk', sans-serif)",
                    }}>
                      {name}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </article>
      {/* blink keyframe defined in globals.css */}
    </section>
  );
}
