/**
 * Lightweight profanity filter for display names and usernames.
 * Checks against a blocklist of common slurs and offensive terms.
 * Uses word-boundary matching so "assassin" or "class" won't false-positive.
 */

const BLOCKED_WORDS = [
  // Common English profanity
  "fuck", "shit", "ass", "bitch", "damn", "cunt", "dick", "cock",
  "pussy", "bastard", "whore", "slut", "fag", "faggot", "nigger",
  "nigga", "retard", "twat",
  // Leet-speak variants
  "f\\*ck", "f\\*\\*k", "sh\\*t", "b\\*tch",
  // Common slurs
  "chink", "spic", "kike", "gook", "tranny", "dyke",
  // Sexual
  "porn", "hentai", "xxx",
  // Violence
  "killyourself", "kys",
];

// Build regex: match whole words or embedded in display names (case insensitive)
const PROFANITY_REGEX = new RegExp(
  `\\b(${BLOCKED_WORDS.join("|")})\\b`,
  "i"
);

function applyLeetSubstitutions(text: string): string {
  return text
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/@/g, "a")
    .replace(/\$/g, "s");
}

/**
 * Returns true if the text contains profanity/offensive language.
 *
 * Checks two normalized forms so we catch both shapes of evasion without
 * false-positiving on legitimate words:
 *   1. Separators (underscores/dashes/dots/whitespace) collapsed to a single
 *      space — preserves `\bword\b` boundaries inside multi-word strings, so
 *      "ass kicker" is caught while "Cassandra" is not.
 *   2. Separators stripped entirely — collapses "f.u.c.k" or "s-h-i-t" back
 *      to "fuck"/"shit" so dot/dash-obfuscated slurs trip the same regex.
 *      Word-boundary matching still keeps "Cl.ass.room" → "Classroom" clean
 *      since "ass" is mid-word in the stripped form.
 */
export function containsProfanity(text: string): boolean {
  if (!text) return false;
  const spaced = applyLeetSubstitutions(text.replace(/[_\-.\s]+/g, " "));
  const stripped = applyLeetSubstitutions(text.replace(/[_\-.\s]+/g, ""));
  return PROFANITY_REGEX.test(spaced) || PROFANITY_REGEX.test(stripped);
}

/**
 * Validates a display name. Returns an error message or null if valid.
 * Intentionally permissive on character content — numbers, symbols, and mixed
 * scripts are all fine. The only hard rules are length and profanity.
 */
export function validateDisplayName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return null; // display name is optional
  if (trimmed.length < 2) return "Display name must be at least 2 characters";
  if (trimmed.length > 30) return "Display name must be 30 characters or less";
  if (containsProfanity(trimmed)) return "Display name contains inappropriate language";
  return null;
}
