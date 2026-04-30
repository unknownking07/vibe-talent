/**
 * Homepage live activity section — server-rendered, richer-than-snippet
 * version of the live feed for logged-out visitors.
 *
 * Why this exists alongside `<LiveActivityFeed>`:
 *   - The existing snippet is a 480px-wide centered card that says basically
 *     "@user pushed repo (2m ago)". It works as a tiny social-proof beacon
 *     but undersells the platform — vibe scores, badges, project quality
 *     scores, and shipped work never make it into view.
 *   - This component renders 8–12 richer cards in a 2-column grid (1-col on
 *     mobile) that surface the actual signals that make VibeTalent VibeTalent:
 *     badges, streak counts, project descriptions + tech stack, milestones.
 *
 * Safety guarantees:
 *   - Server component, server-fetched, ISR-cached for 60s. No client JS,
 *     no loading flash, no waterfall.
 *   - Sparse-feed safeguard: if fewer than `SPARSE_THRESHOLD` items are
 *     available, this component returns null and the homepage falls back
 *     to the existing snippet. Ghost-town first-impression is the worst
 *     possible outcome of putting a feed on the marketing page; we'd rather
 *     show a tight, full-looking card than a half-empty grid.
 *   - All copy and CTAs link out — nothing is interactive enough to break.
 */

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, BadgeCheck, Code2, Flame, Rocket, Sparkles, UserPlus } from "lucide-react";
import {
  type HomepageFeedItem,
  MAX_ITEMS,
  SPARSE_THRESHOLD,
} from "@/lib/homepage-feed";

interface LiveFeedSectionProps {
  items: HomepageFeedItem[];
}

/** Relative-time label. Server-rendered so it's frozen to whatever moment
 *  the ISR cache was generated — that's intentional and matches every
 *  other relative-time label we already SSR (e.g. profile pages). */
function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function actionLabel(item: HomepageFeedItem): string {
  switch (item.type) {
    case "project":
      return "shipped";
    case "pr":
      return "merged a PR on";
    case "create":
      return "created";
    case "issue":
      return "opened an issue on";
    case "streak":
      return "logged a coding day";
    case "joined":
      return "joined VibeTalent";
    case "push":
    default:
      return "pushed to";
  }
}

/** Inline subcomponent rather than `const Icon = pickComponent(item)` —
 *  the latter trips `react-hooks/static-components` because the lookup
 *  function is called at render time and the rule treats the return
 *  value as a "component created during render." This pattern keeps the
 *  component identities stable across renders. */
function ActionIcon({ type }: { type: HomepageFeedItem["type"] }) {
  const props = { size: 12, className: "text-[var(--text-muted)] flex-shrink-0" };
  switch (type) {
    case "project":
      return <Rocket {...props} />;
    case "joined":
      return <UserPlus {...props} />;
    case "streak":
      return <Flame {...props} />;
    case "pr":
    case "create":
    case "issue":
    case "push":
    default:
      return <Code2 {...props} />;
  }
}

const BADGE_LABELS: Record<string, string> = {
  bronze: "BRONZE",
  silver: "SILVER",
  gold: "GOLD",
  diamond: "DIAMOND",
};

export function LiveFeedSection({ items }: LiveFeedSectionProps) {
  // Sparse-feed safeguard. The page-level fallback to the old snippet
  // happens by the caller checking `items.length < SPARSE_THRESHOLD` and
  // not rendering us — but we double-guard here so that even if a future
  // caller forgets, we still bail rather than render a sad 3-card grid.
  if (items.length < SPARSE_THRESHOLD) return null;

  // Cap defensively. The fetcher already slices to MAX_ITEMS but a buggy
  // future caller could pass more.
  const cards = items.slice(0, MAX_ITEMS);

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 py-14 sm:py-20">
      {/* Header bar — mirrors the orange-accent "Live Activity" header from
          the existing snippet so the visual language stays consistent. */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 mb-3 px-3 py-1 text-xs font-extrabold uppercase tracking-wider"
            style={{
              backgroundColor: "var(--accent)",
              color: "var(--text-on-inverted)",
              border: "2px solid var(--border-hard)",
              boxShadow: "var(--shadow-brutal-sm)",
            }}
          >
            <span aria-hidden="true" className="live-dot" />
            Live Activity
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold uppercase tracking-tight text-[var(--foreground)]">
            What builders shipped
            <br className="hidden sm:block" />
            <span className="text-accent-brutal"> in the last 24 hours.</span>
          </h2>
        </div>
        <Link
          href="/feed"
          className="btn-brutal btn-brutal-secondary text-sm self-start sm:self-end whitespace-nowrap"
        >
          See full feed
          <ArrowRight size={14} />
        </Link>
      </div>

      {/* Card grid. 1 column < 640px, 2 columns >= 640px. Items themselves
          are server-rendered so cards land in their final positions on
          first paint — no layout shift, no skeleton, no fade-in. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 stagger-children">
        {cards.map((item) => (
          <FeedCard key={item.id} item={item} />
        ))}
      </div>

      {/* Reinforcement banner. Meta Alchemist's "tell people what they will
          gain at the bottom" insight — placed immediately after the proof
          so the CTA reads as "want to be in this list? sign up." */}
      <div
        className="mt-10 flex flex-col sm:flex-row items-center justify-between gap-4 p-5 sm:p-6"
        style={{
          backgroundColor: "var(--bg-inverted)",
          color: "var(--text-on-inverted)",
          border: "2px solid var(--border-hard)",
          boxShadow: "var(--shadow-brutal)",
        }}
      >
        <div className="flex items-start sm:items-center gap-3">
          <Sparkles size={22} className="text-[var(--accent)] flex-shrink-0 mt-0.5 sm:mt-0" />
          <div>
            <div className="text-base sm:text-lg font-extrabold uppercase tracking-tight">
              Your activity goes here next.
            </div>
            <div className="text-xs sm:text-sm opacity-80 font-medium mt-0.5">
              Show up daily. Build a streak. Get discovered. 60-second signup.
            </div>
          </div>
        </div>
        <Link
          href="/auth/signup"
          className="btn-brutal text-sm whitespace-nowrap"
          style={{
            backgroundColor: "var(--accent)",
            color: "var(--text-on-inverted)",
          }}
        >
          Create profile
          <ArrowRight size={14} />
        </Link>
      </div>
    </section>
  );
}

function FeedCard({ item }: { item: HomepageFeedItem }) {
  const initials = item.username.slice(0, 2).toUpperCase();
  const badgeLabel = BADGE_LABELS[item.badge_level];
  const isProject = item.type === "project";

  return (
    <article
      className="p-4 sm:p-5 flex flex-col gap-3 transition-transform"
      style={{
        backgroundColor: "var(--bg-surface)",
        border: "2px solid var(--border-hard)",
        boxShadow: "var(--shadow-brutal-sm)",
      }}
    >
      {/* Top row: avatar + name + action + timestamp. Whole row links to
          the user profile so a logged-out visitor can immediately drill in
          to see what kind of builders use this. */}
      <div className="flex items-start gap-3">
        <Link
          href={`/profile/${item.username}`}
          className="flex-shrink-0"
          aria-label={`View @${item.username}'s profile`}
        >
          <div
            className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center overflow-hidden"
            style={{
              backgroundColor: "var(--bg-inverted)",
              color: "var(--text-on-inverted)",
              border: "2px solid var(--border-hard)",
              borderRadius: "50%",
              fontWeight: 800,
              fontSize: "0.85rem",
            }}
          >
            {item.avatar_url ? (
              <Image
                src={item.avatar_url}
                alt={item.username}
                width={44}
                height={44}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              initials
            )}
          </div>
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <Link
              href={`/profile/${item.username}`}
              className="font-extrabold text-sm sm:text-base text-[var(--foreground)] hover:text-[var(--accent)] transition-colors flex items-center gap-1.5 min-w-0"
            >
              <span className="truncate">
                {item.display_name || `@${item.username}`}
              </span>
              {item.github_verified && (
                <BadgeCheck
                  size={14}
                  className="text-white fill-[#1D9BF0] flex-shrink-0"
                  strokeWidth={2.5}
                  aria-label="GitHub verified"
                />
              )}
            </Link>
            <span className="text-[11px] font-bold text-[var(--text-muted)] tabular-nums flex-shrink-0">
              {relativeTime(item.date)}
            </span>
          </div>

          <div className="mt-1 text-xs sm:text-sm text-[var(--text-secondary)] font-medium flex items-center gap-1.5 flex-wrap">
            <ActionIcon type={item.type} />
            <span>{actionLabel(item)}</span>
            {item.repo_name && !isProject && (
              <span className="font-mono text-[var(--foreground)] font-bold truncate max-w-[180px]">
                {item.repo_name}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Project attachment — when the activity is a shipped project, we
          surface description + tech stack so the card reads like a mini
          portfolio entry, not just a notification. */}
      {isProject && item.project_title && (
        <div
          className="px-3 py-2.5"
          style={{
            backgroundColor: "var(--bg-surface-light)",
            border: "1.5px solid var(--border-subtle)",
          }}
        >
          <div className="font-extrabold text-sm text-[var(--foreground)] truncate">
            {item.project_title}
          </div>
          {item.project_description && (
            <div
              className="mt-1 text-xs text-[var(--text-secondary)] font-medium"
              style={{
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {item.project_description}
            </div>
          )}
          {item.tech_stack && item.tech_stack.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {item.tech_stack.slice(0, 4).map((t) => (
                <span
                  key={t}
                  className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5"
                  style={{
                    backgroundColor: "var(--bg-pill)",
                    color: "var(--text-on-inverted)",
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Signal row: streak count + badge. Always visible (when present)
          so every card carries at least one VibeTalent-specific signal —
          this is what differentiates the homepage feed from a generic
          activity stream. */}
      <div className="flex items-center gap-2 flex-wrap">
        {item.streak >= 1 && (
          <span
            className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wide px-1.5 py-0.5"
            style={{
              backgroundColor: item.streak >= 30 ? "var(--accent)" : "var(--bg-surface-light)",
              color: item.streak >= 30 ? "var(--text-on-inverted)" : "var(--foreground)",
              border: "1.5px solid var(--border-hard)",
            }}
          >
            <Flame size={10} />
            {item.streak}d streak
          </span>
        )}
        {badgeLabel && (
          <span
            className="text-[10px] font-extrabold uppercase tracking-wide px-1.5 py-0.5"
            style={{
              backgroundColor: `var(--badge-${item.badge_level})`,
              color: "#FFFFFF",
              border: "1.5px solid var(--border-hard)",
            }}
          >
            {badgeLabel}
          </span>
        )}
      </div>
    </article>
  );
}
