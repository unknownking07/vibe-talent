// Display sanitiser for strings that arrive from outside.
//
// WHY: the /bags board lists launches nobody on this platform vouched for, so
// token names and symbols are attacker-controlled. React escapes markup, so the
// risk is not injection — it is VISUAL SPOOFING, on the one page whose whole
// claim is that it tells you the truth about a launch.
//
// A live Bags pool at the time of writing was named with a leading U+202E, the
// right-to-left override, which reverses everything rendered after it. The same
// family of tricks hides characters (zero-width), stacks combining marks until
// the row bleeds into its neighbours, or pads a name until it pushes the
// verification badge off screen.
//
// Homoglyphs (Cyrillic "а" for Latin "a") are NOT solved here. Nothing short of
// script-mixing detection catches them, and a false positive would blank a
// legitimate non-Latin token name. The mint is always shown alongside, and that
// is the identifier which cannot be faked.

/**
 * Bidirectional formatting characters: the marks, embeddings, overrides and
 * isolates. Every one of them can reorder the text around it, so none survive.
 */
const BIDI_CONTROLS = /[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;

/**
 * Zero-width and invisible characters, used to hide or pad text.
 *
 * Two families beyond the usual suspects: Unicode tag characters
 * (U+E0000-U+E007F) render as nothing and can carry a hidden payload inside a
 * name, and the Hangul fillers render as blank width, so they survive
 * whitespace collapsing while still padding a row.
 */
const INVISIBLE =
  /[\u00AD\u115F\u1160\u200B-\u200D\u2060\u3164\uFEFF\uFFA0]|[\u{E0000}-\u{E007F}]/gu;

/** C0 and C1 control characters, including the newlines that would break a row. */
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]/g;

/** Combining marks. Legitimate in many scripts; a long run of them is Zalgo. */
const COMBINING_RUN = /(?:\p{Mn}|\p{Me}){3,}/gu;

/** Default display cap: long enough for real token names, short enough for a row. */
const DEFAULT_MAX_LENGTH = 40;

/**
 * Make an untrusted string safe to render next to a trust claim.
 *
 * Returns null when nothing meaningful survives, so callers fall back to the
 * mint rather than rendering an empty element that reads as a missing name.
 */
export function sanitizeDisplayText(
  raw: string | null | undefined,
  maxLength = DEFAULT_MAX_LENGTH,
): string | null {
  if (typeof raw !== "string") return null;

  const cleaned = raw
    .replace(BIDI_CONTROLS, "")
    .replace(INVISIBLE, "")
    .replace(CONTROL_CHARS, "")
    // Keep two marks so accented text survives, and drop the pile.
    .replace(COMBINING_RUN, (run) => Array.from(run).slice(0, 2).join(""))
    // Any remaining whitespace run collapses, so a name cannot use padding to
    // shove the rest of the row out of view.
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return null;

  // Counted in code points: slicing by UTF-16 index would cut an emoji or any
  // astral character in half and leave a replacement glyph behind.
  const chars = [...cleaned];
  return chars.length > maxLength
    ? `${chars.slice(0, maxLength - 1).join("")}…`
    : cleaned;
}

/**
 * A ticker, cleaned, uppercased and kept short.
 *
 * Symbols render with a `$` in front, which is exactly the context where a
 * reversed or padded string does the most damage.
 */
export function sanitizeSymbol(raw: string | null | undefined): string | null {
  const cleaned = sanitizeDisplayText(raw, 12);
  return cleaned ? cleaned.toUpperCase() : null;
}

/**
 * The only host token artwork may come from.
 *
 * GeckoTerminal re-hosts the images it indexes, so a URL pointing anywhere else
 * did not come from where we think it did. Rendering it would also hand an
 * arbitrary third party a request from every visitor to the board, and
 * next/image throws outright on a host missing from remotePatterns, which would
 * take the page down rather than lose a picture.
 */
const ALLOWED_IMAGE_HOST = "assets.geckoterminal.com";

/** An image URL safe to hand to next/image, or null to fall back to a placeholder. */
export function sanitizeImageUrl(
  raw: string | null | undefined,
): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return null;
    return url.hostname === ALLOWED_IMAGE_HOST ? url.toString() : null;
  } catch {
    return null;
  }
}
