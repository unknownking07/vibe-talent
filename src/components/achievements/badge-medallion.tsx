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

const LOCKED_PALETTE = {
  ring: "#52525B",
  inner: "#A1A1AA",
  glow: "#D4D4D8",
  chip: "#52525B",
  chipText: "#F4F4F5",
};

interface BadgeMedallionProps {
  paletteKey: PaletteKey;
  icon: IconSlug;
  chipLabel?: string;
  size?: number;
  earned?: boolean;
}

/**
 * Custom SVG medallion shown for each achievement.
 *
 * Renders as a div wrapper (for absolute positioning of the icon) + an
 * inline SVG for the rings. This composition works in both the DOM and
 * the next/og edge runtime (Satori supports flex + absolute positioning).
 */
export function BadgeMedallion({
  paletteKey,
  icon,
  chipLabel,
  size = 96,
  earned = true,
}: BadgeMedallionProps) {
  const palette = earned ? PALETTES[paletteKey] : LOCKED_PALETTE;
  const Icon = ICONS[icon] ?? Star;
  const gradId = `bm-${paletteKey}-${icon}-${earned ? "on" : "off"}`;
  const iconSize = Math.round(size * 0.42);
  const chipFontSize = Math.max(9, Math.round(size * 0.13));
  const chipHeight = Math.round(size * 0.22);
  const chipMinWidth = Math.round(size * 0.32);

  return (
    <div
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
        style={{ position: "absolute", top: 0, left: 0, display: "flex" }}
      >
        <defs>
          <radialGradient id={gradId} cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor={palette.glow} />
            <stop offset="100%" stopColor={palette.inner} />
          </radialGradient>
        </defs>
        {/* Outer ring */}
        <circle
          cx="50"
          cy="50"
          r="46"
          fill={palette.ring}
          stroke="#0F0F0F"
          strokeWidth="3"
        />
        {/* Inner gradient disc */}
        <circle
          cx="50"
          cy="50"
          r="34"
          fill={`url(#${gradId})`}
          stroke="#0F0F0F"
          strokeWidth="2"
        />
        {/* Subtle inner highlight arc on top */}
        <path
          d="M 28 38 A 26 26 0 0 1 72 38"
          fill="none"
          stroke={palette.glow}
          strokeWidth="2"
          strokeLinecap="round"
          opacity={earned ? 0.55 : 0.25}
        />
      </svg>
      <Icon
        size={iconSize}
        color="#FFFFFF"
        strokeWidth={2.5}
        style={{
          position: "relative",
          zIndex: 1,
          filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.45))",
        }}
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
