"use client";

import Image from "next/image";
import Link from "next/link";
import {
  BadgeCheck,
  ThumbsUp,
  Star,
  Award,
  Flame,
  Sparkles,
} from "lucide-react";
import { normalizeExternalUrl } from "@/lib/url-normalize";
import type { GroupedFeedItem, BadgeTier } from "./feed-types";

/** Avatar size in px. Compact variant uses a smaller value via a CSS variable. */
const AVATAR_SIZE = 48;

/** Tier → human label for the badge row. */
const BADGE_LABELS: Record<BadgeTier, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  diamond: "Diamond",
};

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

function actionText(item: GroupedFeedItem): string {
  switch (item.type) {
    case "project":
      return "shipped a new project";
    case "pr":
      return item.count > 1 ? `merged ${item.count} PRs into` : "merged PR into";
    case "create":
      return "created branch in";
    case "issue":
      return item.count > 1 ? `opened ${item.count} issues in` : "opened issue in";
    case "streak":
      return "vibed";
    case "joined":
      return "joined VibeTalent";
    case "endorsement":
      return item.target_username
        ? `endorsed @${item.target_username}'s project`
        : "endorsed a project";
    case "review":
      return `received a ${item.rating ?? 5}★ review`;
    case "badge": {
      const label = item.badge_tier ? BADGE_LABELS[item.badge_tier] : "new";
      const days = item.badge_threshold_days
        ? ` (${item.badge_threshold_days}-day streak)`
        : "";
      return `earned ${label} badge${days}`;
    }
    default:
      return item.count > 1 ? `pushed ${item.count} commits to` : "pushed to";
  }
}

/** Map an item type to its row-modifier class. The matching CSS lives in
 *  `<NetworkFeed>`. Achievement-type rows get a colored left border so they
 *  visually pop against routine commits. */
function rowModifierClass(type: GroupedFeedItem["type"], tier?: BadgeTier): string {
  switch (type) {
    case "project":
    case "joined":
    case "streak":
      return "fl-feed-item--accent";
    case "endorsement":
      return "fl-feed-item--endorsement";
    case "review":
      return "fl-feed-item--review";
    case "badge":
      return tier ? `fl-feed-item--badge fl-feed-item--badge-${tier}` : "fl-feed-item--badge";
    default:
      return "";
  }
}

export interface FeedRowProps {
  item: GroupedFeedItem;
  /** When true, drop secondary content (commit messages list, project description)
   *  to keep rows tight on the homepage compact variant. */
  compact?: boolean;
}

/** Pure presentational component for a single feed row. The wrapper assumes
 *  `.fl-*` classes (defined in NetworkFeed's `<style>` block) are loaded. */
export function FeedRow({ item, compact = false }: FeedRowProps) {
  const isMilestone = item.type === "streak" && item.streak >= 30;
  const isProject = item.type === "project";
  const isReview = item.type === "review";
  const isBadge = item.type === "badge";
  const isEndorsement = item.type === "endorsement";
  const initials = item.username.slice(0, 2).toUpperCase();
  const liveHref = normalizeExternalUrl(item.live_url);

  return (
    <div className={`fl-feed-item ${rowModifierClass(item.type, item.badge_tier)}`}>
      <Link href={`/profile/${item.username}`} style={{ textDecoration: "none", flexShrink: 0 }}>
        <div className={`fl-avatar ${isMilestone ? "orange" : ""}`}>
          {item.avatar_url ? (
            <Image
              src={item.avatar_url}
              alt={item.username}
              width={AVATAR_SIZE}
              height={AVATAR_SIZE}
              style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%", opacity: 1 }}
            />
          ) : (
            <span style={{ fontWeight: 600, fontSize: 14, color: isMilestone ? "#0A0A0E" : "var(--text-muted, #8A8B94)" }}>
              {initials}
            </span>
          )}
        </div>
      </Link>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, paddingTop: 4 }}>
        <div style={{ fontSize: 15, color: "var(--text-secondary)" }}>
          <Link
            href={`/profile/${item.username}`}
            style={{
              color: "var(--foreground)",
              fontWeight: 600,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            {item.display_name || item.username}
            {item.github_verified && (
              <BadgeCheck
                size={14}
                className="text-white fill-[#1D9BF0] shrink-0"
                strokeWidth={2.5}
                aria-label="GitHub verified"
              />
            )}
          </Link>
          {item.display_name && (
            <span style={{ color: "var(--text-muted)", fontWeight: 500, marginLeft: 6 }}>
              @{item.username}
            </span>
          )}{" "}
          {actionText(item)}

          {/* Repo tag for GitHub events */}
          {item.repo_name && item.type !== "project" && item.type !== "streak" && !isEndorsement && !isReview && !isBadge && (
            <span className="fl-tag fl-tag-dark">{item.repo_name}</span>
          )}

          {/* Endorsement target link + project title */}
          {isEndorsement && item.project_title && (
            <span className="fl-tag fl-tag-dark">{item.project_title}</span>
          )}
          {isEndorsement && (
            <ThumbsUp
              size={14}
              style={{ color: "var(--accent-green, #4ade80)", marginLeft: 6, verticalAlign: "middle" }}
              aria-hidden
            />
          )}

          {/* Review stars */}
          {isReview && item.rating != null && (
            <span className="fl-tag fl-tag-stars" aria-label={`${item.rating} out of 5 stars`}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  size={12}
                  className={i < (item.rating ?? 0) ? "fl-star-filled" : "fl-star-empty"}
                />
              ))}
            </span>
          )}

          {/* Streak milestone tag */}
          {item.streak >= 30 && item.type === "streak" && (
            <span className="fl-tag fl-tag-orange">
              <Flame size={12} /> {item.streak}d streak
            </span>
          )}
          {item.streak > 1 && item.streak < 30 && (item.type === "push" || item.type === "streak") && (
            <span className="fl-tag fl-tag-dark">
              <Flame size={12} /> {item.streak}d
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13, color: "var(--text-muted)" }}>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{relativeTime(item.date)}</span>
          {item.count > 1 && (
            <>
              <span>·</span>
              <span>{item.count} events</span>
            </>
          )}
        </div>

        {/* Commit messages — skipped in compact mode and on standalone types */}
        {!compact && item.messages.length > 0 && !isProject && !isReview && !isBadge && !isEndorsement && (
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
            {item.messages.slice(0, 3).map((msg, i) => (
              <div
                key={i}
                style={{
                  fontSize: 13,
                  color: "var(--text-secondary)",
                  fontFamily: "var(--font-jetbrains-mono, monospace)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                &quot;{msg}&quot;
              </div>
            ))}
          </div>
        )}

        {/* Review comment */}
        {isReview && item.review_comment && (
          <div
            style={{
              marginTop: 4,
              fontSize: 13,
              color: "var(--text-secondary)",
              fontStyle: "italic",
              lineHeight: 1.5,
            }}
          >
            &ldquo;{item.review_comment}&rdquo;
          </div>
        )}

        {/* Badge tier card — small inline indicator */}
        {isBadge && item.badge_tier && (
          <div className="fl-attachment fl-attachment-badge">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Award size={16} style={{ color: `var(--badge-${item.badge_tier}, var(--accent))` }} />
              <span style={{ fontSize: 14, fontWeight: 500, color: "var(--foreground)" }}>
                {BADGE_LABELS[item.badge_tier]} tier unlocked
              </span>
            </div>
            {item.badge_threshold_days && (
              <span className="fl-tag fl-tag-dark" style={{ fontSize: 11 }}>
                {item.badge_threshold_days}-day streak
              </span>
            )}
          </div>
        )}

        {/* Project attachment card */}
        {isProject && (
          <div className="fl-attachment">
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: "var(--foreground)" }}>
                {item.project_title}
              </div>
              {!compact && item.project_description && (
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--text-muted, #8A8B94)",
                    marginTop: 2,
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
                <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
                  {item.tech_stack.slice(0, 4).map((t) => (
                    <span key={t} className="fl-tag fl-tag-dark" style={{ fontSize: 11 }}>
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
            {liveHref && (
              <a
                href={liveHref}
                target="_blank"
                rel="noopener noreferrer"
                style={{ flexShrink: 0, color: "var(--text-muted, #8A8B94)" }}
                aria-label="Open live site"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7"></path>
                </svg>
              </a>
            )}
          </div>
        )}

        {/* Joined milestone card */}
        {item.type === "joined" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
            <Sparkles size={14} style={{ color: "var(--accent)" }} aria-hidden />
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
              New builder · welcome them
            </span>
          </div>
        )}

        {/* Streak milestone card (30+ days) */}
        {isMilestone && (
          <div className="fl-attachment milestone">
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: "var(--accent, #FF4A2A)" }}>
                <Flame size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
                {item.streak} Day Streak
              </div>
              <div style={{ fontSize: 13, color: "var(--text-muted, #8A8B94)", marginTop: 2 }}>
                Consistent builder
              </div>
            </div>
            <span className="fl-tag fl-tag-orange">Active</span>
          </div>
        )}
      </div>
    </div>
  );
}
