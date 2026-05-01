"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  type FeedItem,
  type GroupedFeedItem,
  type FeedFilter,
  type LiveStats,
  GROUP_WINDOW,
  FILTER_LABELS,
  isStandaloneType,
} from "./feed-types";
import { FeedRow } from "./feed-row";

/** Group adjacent push/pr/create/issue events from the same user+repo
 *  within a 4-hour window into one row. Standalone types (project, review,
 *  endorsement, badge, joined) always render as their own row regardless. */
function groupFeedItems(items: FeedItem[]): GroupedFeedItem[] {
  const grouped: GroupedFeedItem[] = [];
  for (const item of items) {
    if (isStandaloneType(item.type)) {
      grouped.push({ ...item, count: 1, messages: [] });
      continue;
    }
    const existing = grouped.find(
      (g) =>
        g.type === item.type &&
        g.username === item.username &&
        g.repo_name === item.repo_name &&
        !isStandaloneType(g.type) &&
        Math.abs(new Date(g.date).getTime() - new Date(item.date).getTime()) < GROUP_WINDOW,
    );
    if (existing) {
      existing.count++;
      if (
        item.message &&
        item.message !== "pushed code" &&
        item.message !== "opened a pull request" &&
        !existing.messages.includes(item.message)
      ) {
        existing.messages.push(item.message);
      }
    } else {
      const messages: string[] = [];
      if (
        item.message &&
        item.message !== "pushed code" &&
        item.message !== "opened a pull request"
      ) {
        messages.push(item.message);
      }
      grouped.push({ ...item, count: 1, messages });
    }
  }
  return grouped;
}

/** Map a filter chip onto the underlying FeedItem types. The "push" chip
 *  collapses both `push` and `create` events into "Commits" because users
 *  don't think of branch creation as a distinct activity. */
function matchesFilter(item: GroupedFeedItem, filter: FeedFilter): boolean {
  if (filter === "all") return true;
  if (filter === "push") return item.type === "push" || item.type === "create";
  return item.type === filter;
}

/** Stable, ordered list of filter chips for both variants. Ordered by what
 *  Meta called "show off"-worthy first: ships → reviews → endorsements →
 *  badges → routine GitHub activity. */
const FILTER_ORDER: FeedFilter[] = [
  "all",
  "project",
  "review",
  "endorsement",
  "badge",
  "push",
  "pr",
  "streak",
  "joined",
];

/** Inline `<style>` block. Kept here (not in a global stylesheet) so the
 *  feed component is fully self-contained — drop it on any page and it
 *  brings its own styles. The class names are `fl-` prefixed to avoid
 *  collisions. */
const FEED_STYLES = `
.feed-layout { display: grid; grid-template-columns: 240px 1fr 320px; gap: 48px; max-width: 1440px; margin: 0 auto; padding: 40px; min-height: 100vh; }
.feed-layout::before { content: ''; position: fixed; top: -20vh; left: 20vw; width: 60vw; height: 60vw; background: radial-gradient(circle, rgba(255,74,42,0.06) 0%, transparent 60%); z-index: -1; pointer-events: none; }
.fl-sidebar { position: sticky; top: 100px; height: calc(100vh - 140px); display: flex; flex-direction: column; gap: 32px; }
.fl-nav-item { display: flex; align-items: center; justify-content: space-between; padding: 10px 16px; border-radius: 999px; color: var(--text-muted, #8A8B94); text-decoration: none; font-size: 14px; font-weight: 700; transition: all 0.2s ease; border: 1px solid transparent; cursor: pointer; background: none; width: 100%; text-align: left; font-family: inherit; }
.fl-nav-item:hover { color: var(--foreground, #fff); background: var(--bg-surface, #15151A); }
.fl-nav-item.active { color: #0A0A0E; background: var(--accent, #FF4A2A); }
.fl-nav-count { background: var(--bg-surface-light, #F5F5F5); color: inherit; padding: 2px 8px; border-radius: 999px; font-size: 12px; opacity: 0.8; }
.fl-nav-item.active .fl-nav-count { background: rgba(0,0,0,0.15); }
.fl-feed-item { display: flex; gap: 16px; padding: 24px 0; border-bottom: 1px solid var(--border-subtle, #D4D4D4); transition: all 0.2s; padding-left: 16px; border-left: 3px solid transparent; }
.fl-feed-item:hover { background: var(--bg-surface-light, #F5F5F5); border-radius: 0 8px 8px 0; }
.fl-feed-item--accent { border-left-color: var(--accent, #FF4A2A); }
.fl-feed-item--endorsement { border-left-color: var(--accent-green, #4ade80); }
.fl-feed-item--review { border-left-color: #a78bfa; }
.fl-feed-item--badge { border-left-color: var(--accent, #FF4A2A); }
.fl-feed-item--badge-bronze { border-left-color: var(--badge-bronze, #cd7f32); }
.fl-feed-item--badge-silver { border-left-color: var(--badge-silver, #c0c0c0); }
.fl-feed-item--badge-gold { border-left-color: var(--badge-gold, #ffd700); }
.fl-feed-item--badge-diamond { border-left-color: var(--badge-diamond, #b9f2ff); }
.fl-avatar { width: 48px; height: 48px; border-radius: 50%; background: var(--bg-surface, #15151A); border: 1px solid var(--border-hard, #2A2A33); display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; }
.fl-avatar img { width: 100%; height: 100%; object-fit: cover; opacity: 1; }
.fl-avatar.orange { background: var(--accent, #FF4A2A); border-color: var(--accent, #FF4A2A); color: #0A0A0E; font-weight: 600; font-size: 14px; }
.fl-tag { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 999px; font-size: 12px; font-weight: 500; vertical-align: middle; margin: 0 4px; }
.fl-tag-dark { background: var(--bg-surface, #15151A); border: 1px solid var(--border-hard, #2A2A33); color: var(--foreground, #fff); }
.fl-tag-orange { background: var(--accent, #FF4A2A); color: #0A0A0E; }
.fl-tag-stars { gap: 1px; padding: 0 4px; }
.fl-star-filled { color: #facc15; fill: #facc15; }
.fl-star-empty { color: var(--text-muted, #8A8B94); }
.fl-attachment { margin-top: 12px; padding: 16px; border-radius: 12px; background: var(--bg-surface, #15151A); border: 1px solid var(--border-hard, #2A2A33); display: flex; align-items: center; justify-content: space-between; }
.fl-attachment.milestone { border-color: var(--accent, #FF4A2A); background: rgba(255,74,42,0.06); }
.fl-attachment-badge { padding: 12px 16px; }
.fl-card-pale { background: var(--accent-pale, #E8F1EF); border-radius: 24px; padding: 24px; color: #0A0A0E; display: flex; flex-direction: column; gap: 20px; }
.fl-card-dark { border: 1px solid var(--border-hard, #2A2A33); border-radius: 24px; padding: 24px; display: flex; flex-direction: column; gap: 16px; }
.fl-stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.fl-section-label { display: flex; align-items: center; gap: 12px; font-size: 13px; color: var(--text-muted, #8A8B94); margin-bottom: 16px; }
.fl-section-num { font-variant-numeric: tabular-nums; }
.fl-section-pill { background: var(--bg-surface-light, #F5F5F5); color: var(--foreground); padding: 4px 12px; border-radius: 999px; display: inline-flex; align-items: center; gap: 6px; font-size: 13px; }
.fl-chip-row { display: flex; gap: 8px; flex-wrap: wrap; padding-bottom: 16px; border-bottom: 1px solid var(--border-subtle, #D4D4D4); }
.fl-chip { padding: 6px 12px; border-radius: 999px; font-size: 13px; font-weight: 600; cursor: pointer; background: var(--bg-surface, #15151A); border: 1px solid var(--border-hard, #2A2A33); color: var(--text-muted, #8A8B94); transition: all 0.15s ease; font-family: inherit; }
.fl-chip:hover { color: var(--foreground); }
.fl-chip.active { background: var(--accent, #FF4A2A); color: #0A0A0E; border-color: var(--accent, #FF4A2A); }
@media(max-width:1100px) { .feed-layout { grid-template-columns: 1fr; padding: 16px; gap: 24px; } .fl-sidebar { position: static; height: auto; } .fl-sidebar-right { display: none; } .fl-nav-list { display: flex; flex-wrap: wrap; gap: 6px; } .fl-nav-item { width: auto; padding: 8px 14px; font-size: 13px; } }
`;

export interface NetworkFeedProps {
  /** "full" — three-column layout with filter sidebar + Network Velocity stats.
   *  Used on `/feed`.
   *  "compact" — single-column with inline filter chips above the rows.
   *  Used on the homepage. */
  variant: "full" | "compact";

  /** Server-rendered initial items. Used by the homepage so the first paint
   *  has data without waiting on the client-side fetch. The component still
   *  polls `/api/feed` on mount to surface fresher activity. */
  initialItems?: FeedItem[];

  /** Cap on rendered rows. Defaults to 50 for full, 10 for compact. */
  limit?: number;
}

const POLL_INTERVAL_FULL = 30_000;
const POLL_INTERVAL_COMPACT = 60_000;

export function NetworkFeed({ variant, initialItems = [], limit }: NetworkFeedProps) {
  const [feed, setFeed] = useState<FeedItem[]>(initialItems);
  const [loading, setLoading] = useState(initialItems.length === 0);
  const [filter, setFilter] = useState<FeedFilter>("all");
  const [stats, setStats] = useState<LiveStats>(null);
  const isFull = variant === "full";
  const effectiveLimit = limit ?? (isFull ? 50 : 10);
  // Track whether the consumer hydrated us with data so we don't briefly
  // flash a "Loading..." state when SSR already provided rows.
  const hydratedRef = useRef(initialItems.length > 0);

  useEffect(() => {
    let cancelled = false;
    const apiLimit = isFull ? 50 : 30;

    const fetchFeed = async () => {
      try {
        const res = await fetch(`/api/feed?limit=${apiLimit}`);
        const data = await res.json();
        if (!cancelled && Array.isArray(data.feed)) {
          setFeed(data.feed);
          hydratedRef.current = true;
        }
      } catch {
        // network errors are swallowed — the server-rendered initial items
        // (or a loading state) keep the page from looking broken.
      } finally {
        if (!cancelled && !hydratedRef.current) setLoading(false);
        else if (!cancelled) setLoading(false);
      }
    };

    fetchFeed();

    if (isFull) {
      // The full feed is the dedicated /feed page — load network stats too.
      fetch("/api/admin-stats")
        .then((r) => r.json())
        .then((d) => {
          if (!cancelled) setStats(d);
        })
        .catch(() => {});
    }

    const pollMs = isFull ? POLL_INTERVAL_FULL : POLL_INTERVAL_COMPACT;
    const interval = setInterval(fetchFeed, pollMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isFull]);

  const grouped = useMemo(() => {
    const g = groupFeedItems(feed);
    return g.filter((i) => matchesFilter(i, filter));
  }, [feed, filter]);

  const counts = useMemo(() => {
    const g = groupFeedItems(feed);
    const result: Record<FeedFilter, number> = {
      all: g.length,
      project: g.filter((i) => i.type === "project").length,
      push: g.filter((i) => i.type === "push" || i.type === "create").length,
      pr: g.filter((i) => i.type === "pr").length,
      review: g.filter((i) => i.type === "review").length,
      endorsement: g.filter((i) => i.type === "endorsement").length,
      badge: g.filter((i) => i.type === "badge").length,
      streak: g.filter((i) => i.type === "streak").length,
      joined: g.filter((i) => i.type === "joined").length,
    };
    return result;
  }, [feed]);

  // Top contributor calculation only needed for the full variant's right rail.
  const topContributor = useMemo(() => {
    if (!isFull) return null;
    const userCounts: Record<string, { count: number; username: string; avatar_url: string | null; streak: number }> = {};
    for (const item of feed) {
      if (!userCounts[item.username]) {
        userCounts[item.username] = {
          count: 0,
          username: item.username,
          avatar_url: item.avatar_url,
          streak: item.streak,
        };
      }
      userCounts[item.username].count++;
    }
    const sorted = Object.values(userCounts).sort((a, b) => b.count - a.count);
    return sorted[0] || null;
  }, [feed, isFull]);

  const visibleRows = grouped.slice(0, effectiveLimit);

  if (loading) {
    return (
      <>
        <style>{FEED_STYLES}</style>
        <div style={{ minHeight: "40vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ color: "var(--text-muted, #8A8B94)", fontSize: "0.85rem" }}>Loading feed...</div>
        </div>
      </>
    );
  }

  // ── Compact variant (homepage) ─────────────────────────────────────────
  if (!isFull) {
    return (
      <section style={{ display: "flex", flexDirection: "column", gap: 20, paddingTop: 8 }}>
        <style>{FEED_STYLES}</style>

        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.03em", color: "var(--foreground)" }}>
            Live Network Feed
          </h2>
          <span className="fl-tag fl-tag-dark"><span style={{ color: "#4ade80" }}>●</span> Live</span>
        </header>

        <div className="fl-chip-row" role="tablist" aria-label="Feed filters">
          {FILTER_ORDER.map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              className={`fl-chip ${filter === f ? "active" : ""}`}
              onClick={() => setFilter(f)}
            >
              {FILTER_LABELS[f]}
              {counts[f] > 0 && filter !== f && (
                <span style={{ marginLeft: 6, opacity: 0.6 }}>{counts[f]}</span>
              )}
            </button>
          ))}
        </div>

        {visibleRows.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted, #8A8B94)", fontSize: "0.9rem" }}>
            No activity yet for this filter — check back soon.
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column" }}>
          {visibleRows.map((item) => (
            <FeedRow key={item.id} item={item} compact />
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "center", paddingTop: 8 }}>
          <Link
            href="/feed"
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--accent)",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            View full feed →
          </Link>
        </div>
      </section>
    );
  }

  // ── Full variant (/feed page) ──────────────────────────────────────────
  return (
    <>
      <style>{FEED_STYLES}</style>
      <div className="feed-layout">
        {/* Left sidebar - Filters */}
        <aside className="fl-sidebar">
          <div>
            <div className="fl-section-label">
              <span className="fl-section-num">01</span>
              <span className="fl-section-pill">Filters</span>
            </div>
            <div className="fl-nav-list" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {FILTER_ORDER.map((f) => (
                <button
                  key={f}
                  className={`fl-nav-item ${filter === f ? "active" : ""}`}
                  onClick={() => setFilter(f)}
                  type="button"
                >
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
            <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.03em", color: "var(--foreground)" }}>
              Live Network Feed
            </h1>
            <span className="fl-tag fl-tag-dark"><span style={{ color: "#4ade80" }}>●</span> Live</span>
          </header>

          {visibleRows.length === 0 && (
            <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted, #8A8B94)", fontSize: "0.9rem" }}>
              No activity yet for this filter.
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column" }}>
            {visibleRows.map((item) => (
              <FeedRow key={item.id} item={item} />
            ))}
          </div>
        </main>

        {/* Right sidebar */}
        <aside className="fl-sidebar fl-sidebar-right">
          <div>
            <div className="fl-section-label">
              <span className="fl-section-num">02</span>
              <span className="fl-section-pill">Trending</span>
            </div>

            {topContributor && (
              <div className="fl-card-pale">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <h3 style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em", maxWidth: "70%" }}>
                    Top contributor this week
                  </h3>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid rgba(0,0,0,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                    </svg>
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
                    <div style={{ fontSize: 13, color: "rgba(0,0,0,0.6)" }}>
                      {topContributor.count} events · {topContributor.streak}d streak
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

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
