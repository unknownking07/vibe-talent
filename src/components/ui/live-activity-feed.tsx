"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Flame, Rocket, Zap, ArrowRight } from "lucide-react";

type FeedItem = {
  id: string;
  type: "streak" | "project";
  username: string;
  avatar_url: string | null;
  streak: number;
  date: string;
  project_title?: string;
};

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function LiveActivityFeed() {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/feed?limit=5")
      .then((r) => r.json())
      .then((d) => { setFeed(d.feed || []); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, []);

  if (!loaded || feed.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
      <div
        style={{
          border: "2px solid var(--border-hard)",
          borderRadius: "12px",
          boxShadow: "var(--shadow-brutal-sm)",
          background: "var(--bg-surface)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 20px",
            borderBottom: "2px solid var(--border-hard)",
            background: "var(--bg-inverted)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Zap size={16} style={{ color: "var(--accent)" }} />
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--text-on-inverted)",
                fontFamily: "var(--font-space-grotesk)",
              }}
            >
              Live Activity
            </span>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#4ade80",
                display: "inline-block",
                animation: "pulse 2s ease-in-out infinite",
              }}
            />
          </div>
          <Link
            href="/feed"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "0.72rem",
              fontWeight: 700,
              color: "var(--accent)",
              textDecoration: "none",
              fontFamily: "var(--font-jetbrains-mono)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            View Full Feed <ArrowRight size={12} />
          </Link>
        </div>

        {/* Feed items */}
        <div>
          {feed.map((item, idx) => (
            <div
              key={item.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "12px 20px",
                borderBottom: idx < feed.length - 1 ? "1px solid var(--border-subtle, var(--border-hard))" : "none",
              }}
            >
              {/* Avatar */}
              <Link href={`/profile/${item.username}`} style={{ flexShrink: 0, textDecoration: "none" }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    border: "2px solid var(--border-hard)",
                    overflow: "hidden",
                    backgroundColor: "var(--bg-inverted)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {item.avatar_url ? (
                    <Image
                      src={item.avatar_url}
                      alt={item.username}
                      width={28}
                      height={28}
                      style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
                    />
                  ) : (
                    <span style={{ color: "var(--text-on-inverted)", fontWeight: 800, fontSize: "0.6rem" }}>
                      {item.username.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
              </Link>

              {/* Icon */}
              {item.type === "streak" ? (
                <Flame size={14} style={{ color: "var(--accent)", flexShrink: 0 }} />
              ) : (
                <Rocket size={14} style={{ color: "var(--accent)", flexShrink: 0 }} />
              )}

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "5px", flexWrap: "wrap" }}>
                <Link
                  href={`/profile/${item.username}`}
                  style={{
                    fontWeight: 800,
                    fontSize: "0.82rem",
                    color: "var(--foreground)",
                    textDecoration: "none",
                    fontFamily: "var(--font-space-grotesk)",
                  }}
                >
                  {item.username}
                </Link>
                <span style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>
                  {item.type === "streak" ? "logged a coding day" : `shipped ${item.project_title}`}
                </span>
                {item.type === "streak" && item.streak > 1 && (
                  <span
                    style={{
                      fontSize: "0.68rem",
                      fontWeight: 700,
                      fontFamily: "var(--font-jetbrains-mono)",
                      color: "var(--accent)",
                      background: "rgba(255,58,0,0.08)",
                      padding: "1px 6px",
                      borderRadius: "4px",
                      border: "1px solid rgba(255,58,0,0.2)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.streak}d streak
                  </span>
                )}
              </div>

              {/* Time */}
              <span
                style={{
                  color: "var(--text-muted)",
                  fontSize: "0.68rem",
                  fontWeight: 600,
                  fontFamily: "var(--font-jetbrains-mono)",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                {relativeTime(item.date)}
              </span>
            </div>
          ))}
        </div>
      </div>
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </section>
  );
}
