import {
  Flame,
  Rocket,
  Package,
  Boxes,
  BadgeCheck,
  Star,
  ThumbsUp,
  Heart,
  PartyPopper,
  Briefcase,
  Zap,
  Target,
  Handshake,
  Trophy,
  Github,
  Megaphone,
  Sunrise,
  type LucideIcon,
} from "lucide-react";
import {
  PALETTES,
  type IconSlug,
  type PaletteKey,
} from "@/lib/achievements/badge-art";

const ICONS: Record<IconSlug, LucideIcon> = {
  flame: Flame,
  rocket: Rocket,
  package: Package,
  boxes: Boxes,
  "badge-check": BadgeCheck,
  star: Star,
  "thumbs-up": ThumbsUp,
  heart: Heart,
  "party-popper": PartyPopper,
  briefcase: Briefcase,
  zap: Zap,
  target: Target,
  handshake: Handshake,
  trophy: Trophy,
  github: Github,
  megaphone: Megaphone,
  sunrise: Sunrise,
};

// Desaturated, dimmed palette for locked badges — reads as "not yet yours".
const LOCKED_PALETTE = {
  ring: "#3A3633",
  inner: "#56514B",
  glow: "#6B655E",
  chip: "#46413B",
  chipText: "#A8A29B",
};

const CENTER_DISC = "#FBFAF8";

interface BadgeMedallionProps {
  paletteKey: PaletteKey;
  icon: IconSlug;
  chipLabel?: string;
  size?: number;
  earned?: boolean;
  /**
   * Enables the gentle idle float (earned badges only). Off by default so
   * static surfaces — the next/og edge image, the compact teaser shelf —
   * stay still. Pure CSS, so it's safe on server-rendered surfaces and
   * is disabled under `prefers-reduced-motion` via the global stylesheet.
   */
  animate?: boolean;
}

/** A 4-point sparkle star centered at (x, y) with reach `r`, in the 0–100 viewBox. */
function sparklePath(x: number, y: number, r: number): string {
  const i = r * 0.3;
  return `M${x} ${y - r}L${x + i} ${y - i}L${x + r} ${y}L${x + i} ${y + i}L${x} ${y + r}L${x - i} ${y + i}L${x - r} ${y}L${x - i} ${y - i}Z`;
}

/**
 * Custom SVG medallion shown for each achievement — a glossy enamel badge:
 * a coloured outer ring, a coloured disc with a top-down gloss sheen and
 * sparkles, and a cream centre disc holding the (coloured) achievement icon.
 *
 * Renders as a div wrapper (for absolute positioning of the icon + chip) plus
 * an inline SVG for the rings. Deliberately Satori-friendly — flat structure,
 * rgba gradient stops, no clipPath — so the exact same component renders in the
 * DOM and in the next/og edge runtime (the share OG image).
 */
export function BadgeMedallion({
  paletteKey,
  icon,
  chipLabel,
  size = 96,
  earned = true,
  animate = false,
}: BadgeMedallionProps) {
  const palette = earned ? PALETTES[paletteKey] : LOCKED_PALETTE;
  const Icon = ICONS[icon] ?? Star;
  const glossId = `bm-gloss-${paletteKey}-${icon}-${earned ? "on" : "off"}-${size}`;
  const iconSize = Math.round(size * 0.24);
  const chipFontSize = Math.max(9, Math.round(size * 0.13));
  const chipHeight = Math.round(size * 0.22);
  const chipMinWidth = Math.round(size * 0.32);

  return (
    <div
      className={animate && earned ? "medallion-float" : undefined}
      style={{
        position: "relative",
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        style={{ position: "absolute", top: 0, left: 0, display: "flex", overflow: "visible" }}
      >
        <defs>
          <linearGradient id={glossId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.34)" />
            <stop offset="52%" stopColor="rgba(255,255,255,0.04)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.14)" />
          </linearGradient>
        </defs>
        {/* Outer ring */}
        <circle cx="50" cy="50" r="48" fill={palette.ring} stroke="#0F0F0F" strokeWidth="2" />
        {/* Coloured inner disc + gloss sheen */}
        <circle cx="50" cy="50" r="39" fill={palette.inner} />
        <circle cx="50" cy="50" r="39" fill={`url(#${glossId})`} />
        {/* Sparkles (earned only). Grouped in a <g> — not a React fragment —
            because Satori (next/og) serializes SVG children to a string and a
            fragment's Symbol type throws "Cannot convert a Symbol value". */}
        {earned ? (
          <g>
            <path d={sparklePath(30, 31, 3.4)} fill="#fff" opacity="0.9" />
            <path d={sparklePath(72, 66, 2.6)} fill="#fff" opacity="0.7" />
            <path d={sparklePath(69, 33, 1.8)} fill="#fff" opacity="0.6" />
          </g>
        ) : null}
        {/* Cream centre disc */}
        <circle cx="50" cy="50" r="22" fill={CENTER_DISC} stroke="#0F0F0F" strokeWidth="2" />
      </svg>
      <Icon
        size={iconSize}
        color={palette.ring}
        strokeWidth={2.4}
        style={{ position: "relative", zIndex: 1 }}
      />
      {chipLabel ? (
        <div
          style={{
            position: "absolute",
            bottom: -Math.round(chipHeight / 3),
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: chipMinWidth,
            height: chipHeight,
            padding: "0 8px",
            backgroundColor: palette.chip,
            color: palette.chipText,
            border: "2px solid #0F0F0F",
            fontSize: chipFontSize,
            fontWeight: 900,
            letterSpacing: "0.04em",
            lineHeight: 1,
            whiteSpace: "nowrap",
          }}
        >
          {chipLabel}
        </div>
      ) : null}
    </div>
  );
}
