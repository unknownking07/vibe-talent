/**
 * Visual identity for each achievement badge.
 *
 * Each badge has a palette (color theme), an icon name (resolved at render),
 * and an optional chip label shown on the medallion ribbon (usually the
 * unlock threshold, e.g. "30", "10").
 */

export type PaletteKey =
  | "bronze"
  | "silver"
  | "gold"
  | "diamond"
  | "emerald"
  | "amber"
  | "rose"
  | "violet"
  | "sky"
  | "orange";

export interface BadgePalette {
  /** Outer ring color */
  ring: string;
  /** Inner disc base color */
  inner: string;
  /** Highlight/glow for gradient center */
  glow: string;
  /** Chip background */
  chip: string;
  /** Chip text */
  chipText: string;
}

export const PALETTES: Record<PaletteKey, BadgePalette> = {
  bronze: {
    ring: "#7A4A1F",
    inner: "#C97A3A",
    glow: "#F2B07A",
    chip: "#7A4A1F",
    chipText: "#FFE4C8",
  },
  silver: {
    ring: "#5B5F66",
    inner: "#B0B6BF",
    glow: "#EAEEF3",
    chip: "#5B5F66",
    chipText: "#FFFFFF",
  },
  gold: {
    ring: "#8A5A00",
    inner: "#F0B400",
    glow: "#FFE489",
    chip: "#8A5A00",
    chipText: "#FFF3C2",
  },
  diamond: {
    ring: "#0E6F86",
    inner: "#3FBADD",
    glow: "#A8EDFC",
    chip: "#0E6F86",
    chipText: "#E0F8FE",
  },
  emerald: {
    ring: "#065F46",
    inner: "#10B981",
    glow: "#6EE7B7",
    chip: "#065F46",
    chipText: "#D1FAE5",
  },
  amber: {
    ring: "#92400E",
    inner: "#F59E0B",
    glow: "#FCD34D",
    chip: "#92400E",
    chipText: "#FEF3C7",
  },
  rose: {
    ring: "#9D174D",
    inner: "#EC4899",
    glow: "#F9A8D4",
    chip: "#9D174D",
    chipText: "#FCE7F3",
  },
  violet: {
    ring: "#4C1D95",
    inner: "#8B5CF6",
    glow: "#C4B5FD",
    chip: "#4C1D95",
    chipText: "#EDE9FE",
  },
  sky: {
    ring: "#075985",
    inner: "#0EA5E9",
    glow: "#7DD3FC",
    chip: "#075985",
    chipText: "#E0F2FE",
  },
  orange: {
    ring: "#9A2D00",
    inner: "#FF3A00",
    glow: "#FF9D7A",
    chip: "#9A2D00",
    chipText: "#FFE0D1",
  },
};

export type IconSlug =
  | "flame"
  | "rocket"
  | "package"
  | "boxes"
  | "badge-check"
  | "star"
  | "thumbs-up"
  | "heart"
  | "party-popper"
  | "briefcase"
  | "zap"
  | "target"
  | "handshake"
  | "trophy"
  | "github"
  | "megaphone"
  | "sunrise";

export interface BadgeArt {
  palette: PaletteKey;
  icon: IconSlug;
  /** Bottom chip label (usually the threshold). Falsy hides the chip. */
  chipLabel?: string;
}

export const BADGE_ART: Record<string, BadgeArt> = {
  streak_bronze: { palette: "bronze", icon: "flame", chipLabel: "30" },
  streak_silver: { palette: "silver", icon: "flame", chipLabel: "90" },
  streak_gold: { palette: "gold", icon: "flame", chipLabel: "180" },
  streak_diamond: { palette: "diamond", icon: "flame", chipLabel: "365" },

  project_first: { palette: "emerald", icon: "rocket", chipLabel: "1" },
  project_builder: { palette: "emerald", icon: "package", chipLabel: "5" },
  project_prolific: { palette: "emerald", icon: "boxes", chipLabel: "10" },
  project_verified: { palette: "sky", icon: "badge-check" },
  project_quality: { palette: "gold", icon: "star", chipLabel: "70+" },

  endorse_first: { palette: "rose", icon: "thumbs-up", chipLabel: "1" },
  endorse_liked: { palette: "rose", icon: "heart", chipLabel: "10" },
  endorse_crowd: { palette: "rose", icon: "party-popper", chipLabel: "50" },

  hire_first: { palette: "amber", icon: "briefcase", chipLabel: "1" },
  hire_hot: { palette: "amber", icon: "zap", chipLabel: "5" },
  hire_sealed: { palette: "emerald", icon: "target" },

  review_helpful: { palette: "violet", icon: "handshake", chipLabel: "5" },
  review_pillar: { palette: "violet", icon: "trophy", chipLabel: "25" },

  github_linked: { palette: "sky", icon: "github" },
  referral_first: { palette: "orange", icon: "megaphone" },
  founding_member: { palette: "orange", icon: "sunrise" },
};

export function getBadgeArt(id: string): BadgeArt {
  return BADGE_ART[id] ?? { palette: "silver", icon: "star" };
}
