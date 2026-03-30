"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Activity, Rocket, Flame, ExternalLink, Github, Loader2, GitPullRequest, GitBranch, AlertCircle } from "lucide-react";

type FeedItem = {
  id: string;
  type: "push" | "pr" | "create" | "issue" | "project";
  username: string;
  avatar_url: string | null;
  badge_level: string;
  streak: number;
  date: string;
  repo_name?: string;
  message?: string;
  github_url?: string;
  project_title?: string;
  project_description?: string;
  tech_stack?: string[];
  live_url?: string;
};

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function EventIcon({ type }: { type: string }) {
  if (type === "pr") return <GitPullRequest size={14} style={{ color: "var(--accent)", flexShrink: 0 }} />;
  if (type === "create") return <GitBranch size={14} style={{ color: "var(--accent)", flexShrink: 0 }} />;
  if (type === "issue") return <AlertCircle size={14} style={{ color: "var(--accent)", flexShrink: 0 }} />;
  if (type === "project") return <Rocket size={14} style={{ color: "var(--accent)", flexShrink: 0 }} />;
  return <Flame size={14} style={{ color: "var(--accent)", flexShrink: 0 }} />;
}

function actionText(item: FeedItem): string {
  if (item.type === "project") return `shipped ${item.project_title}`;
  if (item.type === "pr") return "opened a PR";
  if (item.type === "create") return "created";
  if (item.type === "issue") return "opened an issue";
  return "pushed to";
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
        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", fontWeight: 500, margin: 0 }}>Real-time GitHub activity from builders on VibeTalent.</p>
      </div>

      {error && <div style={{ textAlign: "center", padding: "40px 24px", color: "var(--text-muted)", fontSize: "0.85rem", background: "var(--bg-surface)", border: "2px solid var(--border-hard)", borderRadius: 12, boxShadow: "var(--shadow-brutal-sm)" }}>Failed to load feed. Try refreshing.</div>}
      {!error && feed.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 24px", color: "var(--text-muted)", fontSize: "0.9rem", background: "var(--bg-surface)", border: "2px solid var(--border-hard)", borderRadius: 12, boxShadow: "var(--shadow-brutal-sm)" }}>
          <Activity size={32} style={{ color: "var(--border-hard)", marginBottom: 12 }} />
          <p style={{ fontWeight: 700, marginBottom: 4, color: "var(--foreground)" }}>No activity yet</p>
          <p>Activity will appear here as builders push code and ship projects.</p>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {feed.map((item) => (
          <div key={item.id} style={{ background: "var(--bg-surface)", border: "2px solid var(--border-hard)", borderRadius: 12, padding: "14px 16px", boxShadow: "var(--shadow-brutal-sm)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              {/* Avatar */}
              <Link href={`/profile/${item.username}`} style={{ flexShrink: 0, textDecoration: "none", marginTop: 2 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", border: "2px solid var(--border-hard)", overflow: "hidden", backgroundColor: "var(--bg-inverted)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {item.avatar_url ? (
                    <Image src={item.avatar_url} alt={item.username} width={36} height={36} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                  ) : (
                    <span style={{ color: "var(--text-on-inverted)", fontWeight: 800, fontSize: "0.7rem" }}>{item.username.slice(0, 2).toUpperCase()}</span>
                  )}
                </div>
              </Link>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: item.type !== "project" && item.message ? 4 : 0 }}>
                  <EventIcon type={item.type} />
                  <Link href={`/profile/${item.username}`} style={{ fontWeight: 800, fontSize: "0.85rem", color: "var(--foreground)", textDecoration: "none", fontFamily: "var(--font-space-grotesk)" }}>{item.username}</Link>
                  <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>{actionText(item)}</span>
                  {item.repo_name && item.type !== "project" && (
                    <span style={{ fontWeight: 700, fontSize: "0.8rem", fontFamily: "var(--font-jetbrains-mono)", color: "var(--foreground)" }}>{item.repo_name}</span>
                  )}
                  {item.streak > 1 && item.type === "push" && (
                    <span style={{ fontSize: "0.68rem", fontWeight: 700, fontFamily: "var(--font-jetbrains-mono)", color: "var(--accent)", background: "rgba(255,58,0,0.08)", padding: "1px 6px", borderRadius: 4, border: "1px solid rgba(255,58,0,0.2)", whiteSpace: "nowrap" }}>{item.streak}d streak</span>
                  )}
                </div>

                {/* Commit message / PR title */}
                {item.type !== "project" && item.message && item.message !== "logged a coding day" && (
                  <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontFamily: "var(--font-jetbrains-mono)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
                    {item.github_url ? (
                      <a href={item.github_url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--text-muted)", textDecoration: "none" }}>&quot;{item.message}&quot;</a>
                    ) : (
                      <span>&quot;{item.message}&quot;</span>
                    )}
                  </div>
                )}

                {/* Project details */}
                {item.type === "project" && (
                  <div style={{ marginTop: 6 }}>
                    {item.project_description && <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", lineHeight: 1.5, margin: "0 0 8px 0", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{item.project_description}</p>}
                    {item.tech_stack && item.tech_stack.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                        {item.tech_stack.slice(0, 5).map((tech) => (
                          <span key={tech} style={{ fontSize: "0.65rem", fontWeight: 700, fontFamily: "var(--font-jetbrains-mono)", padding: "1px 6px", borderRadius: 3, border: "1px solid var(--border-hard)", color: "var(--foreground)", textTransform: "lowercase" }}>{tech}</span>
                        ))}
                      </div>
                    )}
                    {(item.live_url || item.github_url) && (
                      <div style={{ display: "flex", gap: 10 }}>
                        {item.live_url && <a href={item.live_url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.72rem", fontWeight: 700, fontFamily: "var(--font-jetbrains-mono)", color: "var(--accent)", textDecoration: "none" }}><ExternalLink size={11} />Live</a>}
                        {item.github_url && <a href={item.github_url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.72rem", fontWeight: 700, fontFamily: "var(--font-jetbrains-mono)", color: "var(--text-muted)", textDecoration: "none" }}><Github size={11} />Source</a>}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Time */}
              <span style={{ color: "var(--text-muted)", fontSize: "0.68rem", fontWeight: 600, fontFamily: "var(--font-jetbrains-mono)", whiteSpace: "nowrap", flexShrink: 0, marginTop: 2 }}>{relativeTime(item.date)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
