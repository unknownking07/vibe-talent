/**
 * Normalize a Twitter (X) or Telegram social handle to a bare username.
 *
 * Accepts:
 *   - "abhinav" or "@abhinav"
 *   - "https://x.com/abhinav", "https://twitter.com/abhinav"
 *   - "https://t.me/abhinav", "https://telegram.me/abhinav"
 *   - The same URLs without protocol (e.g. "x.com/abhinav", "t.me/abhinav")
 *   - Subdomains of the platform (e.g. "mobile.twitter.com/abhinav")
 *
 * Rejects: any other URL, or a handle with characters outside [A-Za-z0-9_].
 *
 * Stored values are concatenated into `https://x.com/${handle}` and
 * `https://t.me/${handle}` at render time, so we must keep handles bare.
 */

export type Platform = "twitter" | "telegram";

const URL_HOSTS: Record<Platform, string[]> = {
  twitter: ["twitter.com", "x.com"],
  telegram: ["t.me", "telegram.me"],
};

const HANDLE_PATTERN: Record<Platform, RegExp> = {
  // Twitter handles: 1–15 chars, letters/digits/underscore.
  twitter: /^[A-Za-z0-9_]{1,15}$/,
  // Telegram handles: officially 5–32 chars, but we allow 1–32 to avoid
  // breaking accounts with legacy short names.
  telegram: /^[A-Za-z0-9_]{1,32}$/,
};

// First path segments that look username-shaped but aren't user profiles.
// Without this, "https://x.com/home" or "https://t.me/joinchat/<code>" would
// be persisted as the handles "home" and "joinchat" and render as broken links.
const RESERVED_PATHS: Record<Platform, Set<string>> = {
  twitter: new Set([
    "i",
    "home",
    "explore",
    "intent",
    "search",
    "messages",
    "notifications",
    "settings",
    "compose",
    "share",
    "login",
    "signup",
    "tos",
    "privacy",
  ]),
  telegram: new Set([
    "joinchat",
    "addstickers",
    "share",
    "proxy",
    "c",
    "s",
    "iv",
  ]),
};

const PLATFORM_LABEL: Record<Platform, string> = {
  twitter: "X (Twitter)",
  telegram: "Telegram",
};

const EXAMPLE_DOMAINS: Record<Platform, string> = {
  twitter: "x.com or twitter.com",
  telegram: "t.me or telegram.me",
};

export type NormalizeResult =
  | { ok: true; handle: string }
  | { ok: false; error: string };

export function normalizeSocialHandle(
  input: string | null | undefined,
  platform: Platform
): NormalizeResult {
  const raw = (input ?? "").trim();
  if (!raw) return { ok: true, handle: "" };

  if (looksLikeUrl(raw)) {
    const parsed = parseUrlLike(raw);
    if (!parsed) {
      return {
        ok: false,
        error: `That doesn't look like a valid ${PLATFORM_LABEL[platform]} link.`,
      };
    }
    if (!hostMatches(parsed.host, URL_HOSTS[platform])) {
      return {
        ok: false,
        error: `Use a ${EXAMPLE_DOMAINS[platform]} link or just your username.`,
      };
    }
    // A real profile URL is exactly /<handle>. Anything with multiple path
    // segments is an invite link (/joinchat/<code>), a status permalink
    // (/<user>/status/<id>), or a feature page (/i/communities/<id>).
    const segments = parsed.path.split("/").filter(Boolean);
    if (segments.length !== 1) {
      return {
        ok: false,
        error: `Couldn't read a ${PLATFORM_LABEL[platform]} username from that link.`,
      };
    }
    const handle = segments[0].replace(/^@/, "");
    if (
      !handle ||
      !HANDLE_PATTERN[platform].test(handle) ||
      RESERVED_PATHS[platform].has(handle.toLowerCase())
    ) {
      return {
        ok: false,
        error: `Couldn't read a ${PLATFORM_LABEL[platform]} username from that link.`,
      };
    }
    return { ok: true, handle };
  }

  const handle = raw.replace(/^@/, "");
  if (!HANDLE_PATTERN[platform].test(handle)) {
    return {
      ok: false,
      error: `${PLATFORM_LABEL[platform]} username can only contain letters, numbers, and underscores.`,
    };
  }
  return { ok: true, handle };
}

/**
 * Lenient version for read paths: returns the bare handle if we can extract
 * one, or `null` otherwise. Use this when rendering profile links so legacy
 * accounts that stored a full URL still produce a working `https://x.com/<handle>`
 * (without it, the link becomes `https://x.com/https://x.com/<handle>`).
 */
export function extractSocialHandle(
  input: string | null | undefined,
  platform: Platform
): string | null {
  if (!input) return null;
  const result = normalizeSocialHandle(input, platform);
  return result.ok && result.handle ? result.handle : null;
}

function looksLikeUrl(s: string): boolean {
  // "https://...", "http://...", "//host/...", or "host.tld" / "host.tld/..."
  return /^(https?:)?\/\//i.test(s) || /^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(s);
}

function parseUrlLike(s: string): { host: string; path: string } | null {
  let normalized = s;
  if (!/^https?:\/\//i.test(s)) {
    normalized = s.startsWith("//") ? `https:${s}` : `https://${s}`;
  }
  try {
    const u = new URL(normalized);
    return {
      host: u.hostname.toLowerCase().replace(/^www\./, ""),
      path: u.pathname,
    };
  } catch {
    return null;
  }
}

function hostMatches(host: string, allowed: string[]): boolean {
  return allowed.some((a) => host === a || host.endsWith(`.${a}`));
}
