/**
 * Tour card content for the post-signup onboarding modal.
 *
 * Why pure data (no JSX): keeps the component thin, makes the cards trivially
 * testable, and lets non-engineers iterate on copy without touching React.
 *
 * Card copy matches the actual scoring code so we don't mislead users:
 *  - Streak / badge thresholds: src/lib/scoring-config.ts:43-49
 *  - Vibe-score formula:       src/lib/streak.ts:137-181
 *  - Quality score weighting:  src/lib/github-quality.ts:226-266
 * If those change, update this file too — drift here becomes a credibility bug.
 */

import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Award,
  Code2,
  Flame,
  PartyPopper,
  Rocket,
  Sparkles,
  Trophy,
  User,
  Zap,
} from "lucide-react";

/**
 * `ctaHref` is either:
 *  - a string starting with `/` (static route), OR
 *  - a function that builds a route from the logged-in username (used for
 *    `/profile/${username}` links — we can't hard-code the path), OR
 *  - `null` for cards whose CTA only advances the carousel.
 */
export type CtaTarget = string | ((username: string) => string) | null;

export interface TourCard {
  /** Short uppercase title rendered in the card header. */
  title: string;
  /** One-sentence value prop. Keep under ~140 chars to fit mobile cleanly. */
  body: string;
  /** Lucide icon component, rendered in the hero badge above the title. */
  icon: LucideIcon;
  /** Primary button label. */
  ctaLabel: string;
  /** Where the CTA navigates. `null` = advance to next card. */
  ctaHref: CtaTarget;
  /** Secondary "Learn more →" link. Always points to the GitBook docs. */
  learnMoreHref: string;
}

const DOCS_URL = "https://vibe-talent.gitbook.io/untitled";

export const TOUR_CARDS: readonly TourCard[] = [
  {
    title: "Welcome to VibeTalent",
    body: "The public profile, scoring, and AI matchmaking platform built for vibe coders. Let's walk through what you've unlocked.",
    icon: PartyPopper,
    ctaLabel: "Take the tour",
    ctaHref: null,
    learnMoreHref: DOCS_URL,
  },
  {
    title: "Daily Streaks",
    body: "Commit to GitHub each day and we auto-detect activity to grow your streak. Miss a day and the counter resets — consistency is the whole point.",
    icon: Flame,
    ctaLabel: "View my streak",
    ctaHref: "/dashboard#streak",
    learnMoreHref: DOCS_URL,
  },
  {
    title: "Earn Your Badge",
    body: "Bronze at 30 days, Silver at 90, Gold at 180, Diamond at 365. Your longest streak unlocks the badge — it never downgrades.",
    icon: Award,
    ctaLabel: "See badge tiers",
    ctaHref: null,
    learnMoreHref: DOCS_URL,
  },
  {
    title: "Your Vibe Score",
    body: "Your reputation number: baseline 10 + streak × 2 + project quality + badge bonus + reviews + endorsements. It grows the more you ship.",
    icon: Zap,
    ctaLabel: "View my score",
    ctaHref: (username) => `/profile/${username}`,
    learnMoreHref: DOCS_URL,
  },
  {
    title: "Project Quality Scores",
    body: "Every verified project gets a 0–100 score from GitHub stars, code depth, tests, CI, and maintenance — proof your projects are real.",
    icon: Sparkles,
    ctaLabel: "Add a project",
    ctaHref: "/projects",
    learnMoreHref: DOCS_URL,
  },
  {
    title: "Your Public Profile",
    body: "A shareable URL with your streak, vibe score, badges, and shipped projects. Drop the link anywhere — clients can vet you in seconds.",
    icon: User,
    ctaLabel: "View my profile",
    ctaHref: (username) => `/profile/${username}`,
    learnMoreHref: DOCS_URL,
  },
  {
    title: "Climb the Leaderboard",
    body: "Rankings update live based on your vibe score. Shippers rise, lurkers don't. Top builders get featured.",
    icon: Trophy,
    ctaLabel: "See leaderboard",
    ctaHref: "/leaderboard",
    learnMoreHref: DOCS_URL,
  },
  {
    title: "Live Builder Feed",
    body: "Watch what every builder shipped today — commits, projects, milestones. Comment, react, find collaborators for hackathons.",
    icon: Activity,
    ctaLabel: "Open feed",
    ctaHref: "/feed",
    learnMoreHref: DOCS_URL,
  },
  {
    title: "Embed Your Badge",
    body: "Drop your live VibeTalent badge into any README, portfolio site, or Twitter bio. It updates automatically as your stats grow.",
    icon: Code2,
    ctaLabel: "Get embed code",
    ctaHref: "/settings",
    learnMoreHref: DOCS_URL,
  },
  {
    title: "Meet VibeFinder + Ship Today",
    body: "Our AI agent matches you with paid gigs from real founders based on your stack and score. Now go ship something.",
    icon: Rocket,
    ctaLabel: "Try VibeFinder",
    ctaHref: "/agent",
    learnMoreHref: DOCS_URL,
  },
];

/**
 * Resolve a `ctaHref` to a concrete URL string. Username-bound CTAs fall back
 * to `/dashboard` when no username is available (e.g., the user reloaded the
 * tour before the profile finished loading) so the link is never broken.
 */
export function resolveCtaHref(target: CtaTarget, username: string | null | undefined): string | null {
  if (target === null) return null;
  if (typeof target === "function") {
    return username ? target(username) : "/dashboard";
  }
  return target;
}
