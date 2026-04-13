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

/**
 * Returns true if the text contains profanity/offensive language.
 */
export function containsProfanity(text: string): boolean {
  if (!text) return false;
  // Normalize: strip special chars that might be used to evade
  const normalized = text
    .replace(/[_\-.\s]+/g, " ")  // underscores, dashes, dots → spaces
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/@/g, "a")
    .replace(/\$/g, "s");

  return PROFANITY_REGEX.test(normalized);
}

/**
 * Validates a display name. Returns an error message or null if valid.
 */
export function validateDisplayName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length > 50) return "Display name must be 50 characters or less";
  if (containsProfanity(trimmed)) return "Display name contains inappropriate language";
  return null;
}
