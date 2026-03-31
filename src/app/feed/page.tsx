"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";

type FeedItem = {
  id: string;
  type: "push" | "pr" | "create" | "issue" | "project" | "streak";
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

type GroupedItem = FeedItem & { count: number; messages: string[] };
type Filter = "all" | "push" | "pr" | "project" | "streak";
type LiveStats = { builders: number; projects: number; activeStreaks: number; endorsements: number } | null;

const GROUP_WINDOW = 4 * 60 * 60 * 1000;

function groupFeedItems(items: FeedItem[]): GroupedItem[] {
  const grouped: GroupedItem[] = [];
  for (const item of items) {
    if (item.type === "project") { grouped.push({ ...item, count: 1, messages: [] }); continue; }
    const existing = grouped.find(g =>
      g.type === item.type && g.username === item.username && g.repo_name === item.repo_name &&
      g.type !== "project" && Math.abs(new Date(g.date).getTime() - new Date(item.date).getTime()) < GROUP_WINDOW
    );
    if (existing) {
      existing.count++;
      if (item.message && item.message !== "pushed code" && item.message !== "logged a coding day" && item.message !== "opened a pull request" && !existing.messages.includes(item.message)) {
        existing.messages.push(item.message);
      }
    } else {
      const messages: string[] = [];
      if (item.message && item.message !== "pushed code" && item.message !== "logged a coding day" && item.message !== "opened a pull request") messages.push(item.message);
      grouped.push({ ...item, count: 1, messages });
    }
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
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function actionText(item: GroupedItem): string {
  if (item.type === "project") return "shipped a new project";
  if (item.type === "pr") return item.count > 1 ? `merged ${item.count} PRs into` : "merged PR into";
  if (item.type === "create") return "created branch in";
  if (item.type === "issue") return item.count > 1 ? `opened ${item.count} issues in` : "opened issue in";
  if (item.type === "streak") return "logged coding activity";
  return item.count > 1 ? `pushed ${item.count} commits to` : "pushed to";
}

const FILTER_LABELS: Record<Filter, string> = { all: "All Activity", push: "Commits", pr: "PRs Merged", project: "Shipments", streak: "Streaks" };

export default function FeedPage() {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [stats, setStats] = useState<LiveStats>(null);

  useEffect(() => {
    fetch("/api/feed?limit=50")
      .then((r) => r.json())
      .then((d) => setFeed(d.feed || []))
      .catch(() => {})
      .finally(() => setLoading(false));
    fetch("/api/admin-stats")
      .then((r) => r.json())
      .then((d) => setStats(d))
      .catch(() => {});
  }, []);

  const grouped = useMemo(() => {
    const g = groupFeedItems(feed);
    if (filter === "all") return g;
    if (filter === "push") return g.filter(i => i.type === "push" || i.type === "create");
    return g.filter(i => i.type === filter);
  }, [feed, filter]);

  const counts = useMemo(() => {
    const g = groupFeedItems(feed);
    return {
      all: g.length,
      push: g.filter(i => i.type === "push" || i.type === "create").length,
      pr: g.filter(i => i.type === "pr").length,
      project: g.filter(i => i.type === "project").length,
      streak: g.filter(i => i.type === "streak").length,
    };
  }, [feed]);

  // Find top contributor (most events)
  const topContributor = useMemo(() => {
    const userCounts: Record<string, { count: number; username: string; avatar_url: string | null; streak: number }> = {};
    for (const item of feed) {
      if (!userCounts[item.username]) userCounts[item.username] = { count: 0, username: item.username, avatar_url: item.avatar_url, streak: item.streak };
      userCounts[item.username].count++;
    }
    const sorted = Object.values(userCounts).sort((a, b) => b.count - a.count);
    return sorted[0] || null;
  }, [feed]);

  if (loading) return (
    <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "var(--text-muted, #8A8B94)", fontSize: "0.85rem" }}>Loading feed...</div>
    </div>
  );

  return (
    <>
      <style>{`
        .feed-layout { display: grid; grid-template-columns: 240px 1fr 320px; gap: 48px; max-width: 1440px; margin: 0 auto; padding: 40px; min-height: 100vh; }
        .feed-layout::before { content: ''; position: fixed; top: -20vh; left: 20vw; width: 60vw; height: 60vw; background: radial-gradient(circle, rgba(255,74,42,0.06) 0%, transparent 60%); z-index: -1; pointer-events: none; }
        .fl-sidebar { position: sticky; top: 100px; height: calc(100vh - 140px); display: flex; flex-direction: column; gap: 32px; }
        .fl-nav-item { display: flex; align-items: center; justify-content: space-between; padding: 10px 16px; border-radius: 999px; color: var(--text-muted, #8A8B94); text-decoration: none; font-size: 14px; font-weight: 700; transition: all 0.2s ease; border: 1px solid transparent; cursor: pointer; background: none; width: 100%; text-align: left; font-family: inherit; }
        .fl-nav-item:hover { color: var(--foreground, #fff); background: var(--bg-surface, #15151A); }
        .fl-nav-item.active { color: #0A0A0E; background: var(--accent, #FF4A2A); }
        .fl-nav-count { background: var(--bg-surface-light, #F5F5F5); color: inherit; padding: 2px 8px; border-radius: 999px; font-size: 12px; opacity: 0.8; }
        .fl-nav-item.active .fl-nav-count { background: rgba(0,0,0,0.15); }
        .fl-feed-item { display: flex; gap: 16px; padding: 24px 0; border-bottom: 1px solid var(--border-subtle, #D4D4D4); transition: all 0.2s; }
        .fl-feed-item:hover { background: var(--bg-surface-light, #F5F5F5); border-radius: 8px; margin: 0 -16px; padding: 24px 16px; }
        .fl-avatar { width: 48px; height: 48px; border-radius: 50%; background: var(--bg-surface, #15151A); border: 1px solid var(--border-hard, #2A2A33); display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; }
        .fl-avatar img { width: 100%; height: 100%; object-fit: cover; opacity: 1; }
        .fl-avatar.orange { background: var(--accent, #FF4A2A); border-color: var(--accent, #FF4A2A); color: #0A0A0E; font-weight: 600; font-size: 14px; }
        .fl-tag { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 999px; font-size: 12px; font-weight: 500; vertical-align: middle; margin: 0 4px; }
        .fl-tag-dark { background: var(--bg-surface, #15151A); border: 1px solid var(--border-hard, #2A2A33); color: var(--foreground, #fff); }
        .fl-tag-orange { background: var(--accent, #FF4A2A); color: #0A0A0E; }
        .fl-attachment { margin-top: 12px; padding: 16px; border-radius: 12px; background: var(--bg-surface, #15151A); border: 1px solid var(--border-hard, #2A2A33); display: flex; align-items: center; justify-content: space-between; }
        .fl-attachment.milestone { border-color: var(--accent, #FF4A2A); background: rgba(255,74,42,0.06); }
        .fl-card-pale { background: var(--accent-pale, #E8F1EF); border-radius: 24px; padding: 24px; color: #0A0A0E; display: flex; flex-direction: column; gap: 20px; }
        .fl-card-dark { border: 1px solid var(--border-hard, #2A2A33); border-radius: 24px; padding: 24px; display: flex; flex-direction: column; gap: 16px; }
        .fl-stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .fl-section-label { display: flex; align-items: center; gap: 12px; font-size: 13px; color: var(--text-muted, #8A8B94); margin-bottom: 16px; }
        .fl-section-num { font-variant-numeric: tabular-nums; }
        .fl-section-pill { background: var(--bg-surface-light, #F5F5F5); color: var(--foreground); padding: 4px 12px; border-radius: 999px; display: inline-flex; align-items: center; gap: 6px; font-size: 13px; }
        @media(max-width:1100px) { .feed-layout { grid-template-columns: 1fr; padding: 16px; gap: 24px; } .fl-sidebar { position: static; height: auto; } .fl-sidebar-right { display: none; } .fl-nav-list { display: flex; flex-wrap: wrap; gap: 6px; } .fl-nav-item { width: auto; padding: 8px 14px; font-size: 13px; } }
      `}</style>
      <div className="feed-layout">
        {/* Left sidebar - Filters */}
        <aside className="fl-sidebar">
          <div>
            <div className="fl-section-label">
              <span className="fl-section-num">01</span>
              <span className="fl-section-pill">Filters</span>
            </div>
            <div className="fl-nav-list" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {(Object.keys(FILTER_LABELS) as Filter[]).map(f => (
                <button key={f} className={`fl-nav-item ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
                  {FILTER_LABELS[f]}
                  <span className="fl-nav-count">{counts[f]}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Center feed */}
        <main style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 24, borderBottom: "1px solid var(--border-subtle)" }}>
            <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.03em", color: "var(--foreground)" }}>Live Network Feed</h1>
            <span className="fl-tag fl-tag-dark"><span style={{ color: "#4ade80" }}>●</span> Live</span>
          </header>

          {grouped.length === 0 && (
            <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted, #8A8B94)", fontSize: "0.9rem" }}>
              No activity yet for this filter.
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column" }}>
            {grouped.map((item) => {
              const isMilestone = item.type === "streak" && item.streak >= 30;
              const isProject = item.type === "project";
              const initials = item.username.slice(0, 2).toUpperCase();

              return (
                <div key={item.id} className="fl-feed-item">
                  <Link href={`/profile/${item.username}`} style={{ textDecoration: "none", flexShrink: 0 }}>
                    <div className={`fl-avatar ${isMilestone ? "orange" : ""}`}>
                      {item.avatar_url ? (
                        <Image src={item.avatar_url} alt={item.username} width={48} height={48} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%", opacity: 1 }} />
                      ) : (
                        <span style={{ fontWeight: 600, fontSize: 14, color: isMilestone ? "#0A0A0E" : "var(--text-muted, #8A8B94)" }}>{initials}</span>
                      )}
                    </div>
                  </Link>

                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, paddingTop: 4 }}>
                    <div style={{ fontSize: 15, color: "var(--text-secondary)" }}>
                      <Link href={`/profile/${item.username}`} style={{ color: "var(--foreground)", fontWeight: 600, textDecoration: "none" }}>{item.username}</Link>
                      {" "}{actionText(item)}
                      {item.repo_name && item.type !== "project" && item.type !== "streak" && (
                        <span className="fl-tag fl-tag-dark">{item.repo_name}</span>
                      )}
                      {item.streak >= 30 && item.type === "streak" && (
                        <span className="fl-tag fl-tag-orange">🔥 {item.streak}d streak</span>
                      )}
                      {item.streak > 1 && item.streak < 30 && (item.type === "push" || item.type === "streak") && (
                        <span className="fl-tag fl-tag-dark">🔥 {item.streak}d</span>
                      )}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13, color: "var(--text-muted)" }}>
                      <span style={{ fontVariantNumeric: "tabular-nums" }}>{relativeTime(item.date)}</span>
                      {item.count > 1 && <><span>·</span><span>{item.count} events</span></>}
                    </div>

                    {/* Commit messages */}
                    {item.messages.length > 0 && !isProject && (
                      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                        {item.messages.slice(0, 3).map((msg, i) => (
                          <div key={i} style={{ fontSize: 13, color: "var(--text-secondary)", fontFamily: "var(--font-jetbrains-mono, monospace)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            &quot;{msg}&quot;
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Project attachment card */}
                    {isProject && (
                      <div className="fl-attachment">
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--foreground)" }}>{item.project_title}</div>
                          {item.project_description && (
                            <div style={{ fontSize: 13, color: "var(--text-muted, #8A8B94)", marginTop: 2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{item.project_description}</div>
                          )}
                          {item.tech_stack && item.tech_stack.length > 0 && (
                            <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
                              {item.tech_stack.slice(0, 4).map(t => (
                                <span key={t} className="fl-tag fl-tag-dark" style={{ fontSize: 11 }}>{t}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        {item.live_url && (
                          <a href={item.live_url} target="_blank" rel="noopener noreferrer" style={{ flexShrink: 0, color: "var(--text-muted, #8A8B94)" }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"></path></svg>
                          </a>
                        )}
                      </div>
                    )}

                    {/* Milestone card */}
                    {isMilestone && (
                      <div className="fl-attachment milestone">
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--accent, #FF4A2A)" }}>🔥 {item.streak} Day Streak</div>
                          <div style={{ fontSize: 13, color: "var(--text-muted, #8A8B94)", marginTop: 2 }}>Consistent builder</div>
                        </div>
                        <span className="fl-tag fl-tag-orange">Active</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </main>

        {/* Right sidebar */}
        <aside className="fl-sidebar fl-sidebar-right">
          <div>
            <div className="fl-section-label">
              <span className="fl-section-num">02</span>
              <span className="fl-section-pill">Trending</span>
            </div>

            {/* Top contributor card */}
            {topContributor && (
              <div className="fl-card-pale">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <h3 style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em", maxWidth: "70%" }}>Top contributor this week</h3>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid rgba(0,0,0,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                  <Link href={`/profile/${topContributor.username}`} style={{ textDecoration: "none" }}>
                    <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#15151A", border: "1px solid #2A2A33", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                      {topContributor.avatar_url ? (
                        <Image src={topContributor.avatar_url} alt={topContributor.username} width={48} height={48} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <span style={{ fontWeight: 600, color: "#8A8B94" }}>{topContributor.username.slice(0, 2).toUpperCase()}</span>
                      )}
                    </div>
                  </Link>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#0A0A0E" }}>{topContributor.username}</div>
                    <div style={{ fontSize: 13, color: "rgba(0,0,0,0.6)" }}>{topContributor.count} events · {topContributor.streak}d streak</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Network stats */}
          {stats && (
            <div className="fl-card-dark">
              <div style={{ fontSize: 14, fontWeight: 500, color: "var(--foreground, #fff)" }}>Network Velocity</div>
              <div className="fl-stat-grid">
                <div>
                  <div style={{ fontSize: 20, fontWeight: 500, color: "var(--foreground, #fff)" }}>{stats.builders}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted, #8A8B94)" }}>Builders</div>
                </div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 500, color: "var(--accent, #FF4A2A)" }}>{stats.activeStreaks}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted, #8A8B94)" }}>Active streaks</div>
                </div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 500, color: "var(--foreground, #fff)" }}>{stats.projects}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted, #8A8B94)" }}>Projects shipped</div>
                </div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 500, color: "var(--foreground, #fff)" }}>{stats.endorsements}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted, #8A8B94)" }}>Endorsements</div>
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
