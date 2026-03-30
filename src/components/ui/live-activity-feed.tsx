"use client";

import { useState, useEffect } from "react";
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

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function actionText(item: FeedItem): string {
  if (item.type === "project") return "shipped";
  if (item.type === "pr") return "opened PR in";
  if (item.type === "create") return "created branch in";
  if (item.type === "issue") return "opened issue in";
  if (item.type === "streak") return "logged coding activity";
  return "pushed to";
}

function projectName(item: FeedItem): string | null {
  if (item.type === "project") return item.project_title || null;
  if (item.repo_name) return item.repo_name;
  if (item.message && item.message !== "logged a coding day") return item.message;
  return null;
}

const AVATAR_COLORS = ["#ff4400", "#4a4a4a", "#ffffff", "#ff4400", "#4a4a4a", "#ffffff"];

export function LiveActivityFeed() {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/feed?limit=6")
      .then((r) => {
        if (!r.ok) throw new Error("Feed API error: " + r.status);
        return r.json();
      })
      .then((d) => { setFeed(d.feed || []); setLoaded(true); })
      .catch((err) => { console.error("Live feed fetch error:", err); setLoaded(true); });
  }, []);

  if (!loaded) return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
      <div style={{ textAlign: "center", padding: "20px", color: "var(--text-muted, #8a8a8a)", fontSize: "0.85rem" }}>Loading activity...</div>
    </section>
  );
  if (feed.length === 0) return null;

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
        {/* Orange header */}
        <header style={{
          backgroundColor: "var(--accent, #ff4400)",
          color: "#000",
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
            <div style={{
              width: 8, height: 8,
              backgroundColor: "#000",
              borderRadius: "50%",
              animation: "pulse 2s infinite",
            }} />
            Live Activity
          </div>
          <Link href="/feed" style={{
            backgroundColor: "#fff",
            color: "#000",
            textDecoration: "none",
            fontSize: "0.75rem",
            fontWeight: 700,
            textTransform: "uppercase",
            padding: "6px 12px",
            borderRadius: 999,
            border: "1.5px solid #000",
            transition: "all 0.2s ease",
            whiteSpace: "nowrap",
          }}>
            View Full Feed
          </Link>
        </header>

        {/* Feed items */}
        <div style={{ display: "flex", flexDirection: "column", maxHeight: 500, overflowY: "auto" }}>
          {feed.map((item, idx) => {
            const initials = item.username.slice(0, 2).toUpperCase();
            const bgColor = AVATAR_COLORS[idx % AVATAR_COLORS.length];
            const textColor = bgColor === "#ffffff" ? "#000" : bgColor === "#4a4a4a" ? "#fff" : "#000";
            const name = projectName(item);

            return (
              <Link
                key={item.id}
                href={item.type === "project" ? `/profile/${item.username}` : (item.type !== "streak" && item.repo_name ? `https://github.com/${item.username}/${item.repo_name}` : `/profile/${item.username}`)}
                style={{
                  padding: "1rem 1.25rem",
                  display: "grid",
                  gridTemplateColumns: "auto 1fr",
                  gap: "1rem",
                  borderBottom: idx < feed.length - 1 ? "1px solid #2a2a2a" : "none",
                  transition: "background-color 0.15s ease",
                  textDecoration: "none",
                  color: "inherit",
                }}
                target={item.type !== "project" && item.type !== "streak" ? "_blank" : undefined}
              >
                {/* Avatar */}
                <div style={{
                  width: 40, height: 40,
                  backgroundColor: bgColor,
                  border: "2px solid var(--border-hard, #fff)",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  fontWeight: 800,
                  color: textColor,
                  fontSize: "1rem",
                  textTransform: "uppercase",
                  boxShadow: "2px 2px 0px #000",
                  overflow: "hidden",
                  fontFamily: "var(--font-space-grotesk, 'Space Grotesk', sans-serif)",
                }}>
                  {item.avatar_url ? (
                    <Image src={item.avatar_url} alt={item.username} width={40} height={40} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : initials}
                </div>

                {/* Content */}
                <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 4 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                    <div style={{ fontSize: "0.875rem", lineHeight: 1.2 }}>
                      <span style={{ fontWeight: 700, color: "var(--foreground, #fff)" }}>@{item.username}</span>{" "}
                      <span style={{ color: "var(--text-muted, #8a8a8a)" }}>{actionText(item)}</span>
                    </div>
                    <span style={{
                      fontSize: "0.75rem",
                      color: "var(--text-muted, #8a8a8a)",
                      fontVariantNumeric: "tabular-nums",
                      flexShrink: 0,
                    }}>
                      {relativeTime(item.date)}
                    </span>
                  </div>
                  {name && (
                    <div style={{
                      fontSize: "1rem",
                      fontWeight: 800,
                      fontStyle: "italic",
                      color: "var(--accent, #ff4400)",
                      textTransform: "uppercase",
                      letterSpacing: "-0.5px",
                      lineHeight: 1.1,
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
      <style>{`@keyframes pulse { 0% { transform: scale(0.95); opacity: 1; } 50% { transform: scale(1.2); opacity: 0.5; } 100% { transform: scale(0.95); opacity: 1; } }`}</style>
    </section>
  );
}
