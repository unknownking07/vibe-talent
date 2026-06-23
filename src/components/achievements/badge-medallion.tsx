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
  /**
   * Apply the gentle floating animation. Off by default so the same component
   * renders as a static image in the next/og (Satori) share-card route, which
   * ignores CSS animations anyway. Only the on-page DOM render opts in.
   */
  float?: boolean;
}

/**
 * Four-point sparkle star, expressed as a single path so it renders in both
 * the DOM and the next/og edge runtime (Satori). Coordinates are in the
 * medallion's 0–100 viewBox space.
 */
function sparklePath(x: number, y: number, r: number, opacity: number, key: string) {
  const k = r * 0.3;
  const d = [
    `M${x} ${y - r}`,
    `L${x + k} ${y - k}`,
    `L${x + r} ${y}`,
    `L${x + k} ${y + k}`,
    `L${x} ${y + r}`,
    `L${x - k} ${y + k}`,
    `L${x - r} ${y}`,
    `L${x - k} ${y - k}`,
    "Z",
  ].join(" ");
  return <path key={key} d={d} fill="#FFFFFF" opacity={opacity} />;
}

/**
 * Custom SVG medallion shown for each achievement ("Flat Gloss" style).
 *
 * Layered as: outer ring → inner colored disc → glossy highlight overlay →
 * sparkles → white center cap holding the icon. Renders as a div wrapper (for
 * absolute positioning of the icon) + an inline SVG for the rings. This
 * composition works in both the DOM and the next/og edge runtime (Satori
 * supports flex + absolute positioning, linearGradient, circle and path — but
 * not clipPath, so sparkles are positioned within the disc rather than clipped).
 */
export function BadgeMedallion({
  paletteKey,
  icon,
  chipLabel,
  size = 96,
  earned = true,
  float = false,
}: BadgeMedallionProps) {
  const palette = earned ? PALETTES[paletteKey] : LOCKED_PALETTE;
  const Icon = ICONS[icon] ?? Star;
  const glossId = `bm-gloss-${paletteKey}-${icon}-${earned ? "on" : "off"}`;
  const iconSize = Math.round(size * 0.26);
  const chipFontSize = Math.max(9, Math.round(size * 0.13));
  const chipHeight = Math.round(size * 0.22);
  const chipMinWidth = Math.round(size * 0.32);

  return (
    <div
      className={float && earned ? "ach-float" : undefined}
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
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.34} />
            <stop offset="52%" stopColor="#FFFFFF" stopOpacity={0.04} />
            <stop offset="100%" stopColor="#000000" stopOpacity={0.14} />
          </linearGradient>
        </defs>
        {/* Outer ring */}
        <circle cx="50" cy="50" r="48" fill={palette.ring} stroke="#0F0F0F" strokeWidth="2" />
        {/* Inner colored disc */}
        <circle cx="50" cy="50" r="39" fill={palette.inner} />
        {/* Glossy highlight overlay */}
        <circle cx="50" cy="50" r="39" fill={`url(#${glossId})`} />
        {/* Sparkles (positioned inside the disc so no clip path is needed) */}
        {earned ? (
          <>
            {sparklePath(30, 31, 3.4, 0.9, "sp1")}
            {sparklePath(72, 66, 2.6, 0.7, "sp2")}
            {sparklePath(69, 33, 1.8, 0.6, "sp3")}
          </>
        ) : null}
        {/* White center cap */}
        <circle cx="50" cy="50" r="22" fill="#FBFAF8" stroke="#0F0F0F" strokeWidth="2" />
      </svg>
      <Icon
        size={iconSize}
        color={palette.ring}
        strokeWidth={2.3}
        style={{ position: "relative", zIndex: 1, display: "flex" }}
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
