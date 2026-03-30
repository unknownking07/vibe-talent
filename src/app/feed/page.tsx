"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Activity, Rocket, Flame, ExternalLink, Github, Loader2 } from "lucide-react";

type FeedItem = {
  id: string;
  type: "streak" | "project";
  username: string;
  avatar_url: string | null;
  badge_level: string;
  streak: number;
  date: string;
  project_title?: string;
  project_description?: string;
  tech_stack?: string[];
  live_url?: string;
  github_url?: string;
};

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export default function FeedPage() {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/feed?limit=50")
      .then((res) => { if (!res.ok) throw new Error(); return res.json(); })
      .then((data) => setFeed(data.feed || []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ minHeight: "80vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
      <Loader2 size={28} style={{ color: "var(--accent)", animation: "spin 1s linear infinite" }} />
      <span style={{ color: "var(--text-muted)", fontFamily: "var(--font-jetbrains-mono)", fontSize: "0.85rem" }}>Loading feed...</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "32px 16px 80px" }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <Activity size={22} style={{ color: "var(--accent)" }} />
          <h1 style={{ fontSize: "1.75rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "-0.02em", color: "var(--foreground)", fontFamily: "var(--font-space-grotesk)", margin: 0 }}>Feed</h1>
        </div>
        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", fontWeight: 500, margin: 0 }}>See what builders are shipping and who&apos;s keeping their streak alive.</p>
      </div>

      {error && <div style={{ textAlign: "center", padding: "40px 24px", color: "var(--text-muted)", fontSize: "0.85rem", background: "var(--bg-surface)", border: "2px solid var(--border-hard)", borderRadius: 12, boxShadow: "var(--shadow-brutal-sm)" }}>Failed to load feed. Try refreshing.</div>}

      {!error && feed.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 24px", color: "var(--text-muted)", fontSize: "0.9rem", background: "var(--bg-surface)", border: "2px solid var(--border-hard)", borderRadius: 12, boxShadow: "var(--shadow-brutal-sm)" }}>
          <Activity size={32} style={{ color: "var(--border-hard)", marginBottom: 12 }} />
          <p style={{ fontWeight: 700, marginBottom: 4, color: "var(--foreground)" }}>No activity yet</p>
          <p>Be the first to log a streak or ship a project.</p>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {feed.map((item) => (
          <div key={item.id} style={{ background: "var(--bg-surface)", border: "2px solid var(--border-hard)", borderRadius: 12, padding: 16, boxShadow: "var(--shadow-brutal-sm)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: item.type === "project" ? 12 : 0 }}>
              <Link href={`/profile/${item.username}`} style={{ flexShrink: 0, textDecoration: "none" }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", border: "2px solid var(--border-hard)", overflow: "hidden", backgroundColor: "var(--bg-inverted)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {item.avatar_url ? (
                    <Image src={item.avatar_url} alt={item.username} width={40} height={40} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                  ) : (
                    <span style={{ color: "var(--text-on-inverted)", fontWeight: 800, fontSize: "0.75rem" }}>{item.username.slice(0, 2).toUpperCase()}</span>
                  )}
                </div>
              </Link>
              <div style={{ flex: 1, minWidth: 0 }}>
                {item.type === "streak" ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <Flame size={16} style={{ color: "var(--accent)", flexShrink: 0 }} />
                    <Link href={`/profile/${item.username}`} style={{ fontWeight: 800, fontSize: "0.88rem", color: "var(--foreground)", textDecoration: "none" }}>{item.username}</Link>
                    <span style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>logged a coding day</span>
                    {item.streak > 1 && <span style={{ fontSize: "0.72rem", fontWeight: 700, fontFamily: "var(--font-jetbrains-mono)", color: "var(--accent)", background: "rgba(255,58,0,0.08)", padding: "2px 8px", borderRadius: 6, border: "1px solid rgba(255,58,0,0.2)", whiteSpace: "nowrap" }}>{item.streak} day streak</span>}
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <Rocket size={16} style={{ color: "var(--accent)", flexShrink: 0 }} />
                    <Link href={`/profile/${item.username}`} style={{ fontWeight: 800, fontSize: "0.88rem", color: "var(--foreground)", textDecoration: "none" }}>{item.username}</Link>
                    <span style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>shipped</span>
                    <span style={{ fontWeight: 800, fontSize: "0.88rem", color: "var(--foreground)" }}>{item.project_title}</span>
                  </div>
                )}
              </div>
              <span style={{ color: "var(--text-muted)", fontSize: "0.7rem", fontWeight: 600, fontFamily: "var(--font-jetbrains-mono)", whiteSpace: "nowrap", flexShrink: 0 }}>{relativeTime(item.date)}</span>
            </div>

            {item.type === "project" && (
              <div style={{ paddingLeft: 50 }}>
                {item.project_description && <p style={{ color: "var(--text-muted)", fontSize: "0.82rem", lineHeight: 1.5, margin: "0 0 10px 0", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{item.project_description}</p>}
                {item.tech_stack && item.tech_stack.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
                    {item.tech_stack.slice(0, 6).map((tech) => (
                      <span key={tech} style={{ fontSize: "0.68rem", fontWeight: 700, fontFamily: "var(--font-jetbrains-mono)", padding: "2px 8px", borderRadius: 4, border: "1px solid var(--border-hard)", background: "var(--bg-surface)", color: "var(--foreground)", textTransform: "lowercase" }}>{tech}</span>
                    ))}
                    {item.tech_stack.length > 6 && <span style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--text-muted)", padding: "2px 6px" }}>+{item.tech_stack.length - 6}</span>}
                  </div>
                )}
                {(item.live_url || item.github_url) && (
                  <div style={{ display: "flex", gap: 10 }}>
                    {item.live_url && <a href={item.live_url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.75rem", fontWeight: 700, fontFamily: "var(--font-jetbrains-mono)", color: "var(--accent)", textDecoration: "none" }}><ExternalLink size={12} />Live</a>}
                    {item.github_url && <a href={item.github_url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.75rem", fontWeight: 700, fontFamily: "var(--font-jetbrains-mono)", color: "var(--text-muted)", textDecoration: "none" }}><Github size={12} />Source</a>}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
