import type { CSSProperties } from "react";

/**
 * Brand glyphs. Exactly one survives: the VibeFinder bot, the product's
 * character mark, distinctive enough to justify a custom drawing.
 *
 * The streak flame and vibe bolt were custom once too, and got retired the
 * same day: at 14-18px a hand-authored path reads emoji-ish next to a
 * professionally drawn set. Metrics use Phosphor `Fire`/`Lightning` in
 * weight="fill"; stat strips use no icon at all. Don't re-add glyphs here
 * unless they identify the brand the way a logo does.
 *
 * Prop-compatible with the Phosphor components (`size`, `weight`,
 * `className`, `style`). No "use client": pure render, safe everywhere.
 */
export interface BrandIconProps {
  size?: number;
  weight?: "fill" | "duotone" | "regular" | "bold";
  className?: string;
  style?: CSSProperties;
  "aria-label"?: string;
}

function svgProps({
  size = 24,
  className,
  style,
  "aria-label": ariaLabel,
}: BrandIconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    className,
    style,
    "aria-label": ariaLabel,
    "aria-hidden": ariaLabel ? undefined : true,
    focusable: false,
  } as const;
}

/** VibeFinder bot — rounded head, punched-out eyes, antenna. */
export function BotMark(props: BrandIconProps) {
  const filled = props.weight !== "regular" && props.weight !== "bold";
  const head =
    "M8.5 7h7a4 4 0 0 1 4 4v4a4 4 0 0 1-4 4h-7a4 4 0 0 1-4-4v-4a4 4 0 0 1 4-4Z";
  const eyeL = "M8.1 13a1.6 1.6 0 1 0 3.2 0 1.6 1.6 0 1 0-3.2 0Z";
  const eyeR = "M12.7 13a1.6 1.6 0 1 0 3.2 0 1.6 1.6 0 1 0-3.2 0Z";
  return (
    <svg {...svgProps(props)}>
      <path
        d="M12 4.5v2.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="12" cy="3.4" r="1.5" fill="currentColor" />
      {filled ? (
        // evenodd punches the eyes out of the head, so whatever sits behind
        // the icon (accent tile, card surface) shows through — works on any
        // background without needing a second colour.
        <path
          d={`${head} ${eyeL} ${eyeR}`}
          fill="currentColor"
          fillRule="evenodd"
        />
      ) : (
        <>
          <path
            d={head}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path d={`${eyeL} ${eyeR}`} fill="currentColor" />
        </>
      )}
    </svg>
  );
}
