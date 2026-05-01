import { parseGithubRepoUrl } from "@/lib/github-quality";

/**
 * Normalize a user-supplied external URL for safe rendering.
 *
 * Accepts inputs with or without a protocol (e.g. "github.com/x/y",
 * "//example.com", or "https://example.com") and returns a canonical
 * `https://...` URL. Returns `null` for inputs that cannot be parsed
 * as an absolute URL — call sites should fall back to rendering without
 * an `<a>` wrapper rather than linking to `#`.
 *
 * Rejects `javascript:`, `data:`, `file:` and any other non-http(s) scheme
 * even if explicitly typed by the user, since those are unsafe to surface
 * in third-party UGC links.
 *
 * Background: project rows like Meta's SPARK saved `github.com/...` (no
 * protocol). The browser interpreted that as a relative path, producing
 * URLs like `https://www.vibetalent.work/profile/github.com/...`. This
 * helper kills that class of bug at every render site.
 */
export function normalizeExternalUrl(
  input: string | null | undefined,
): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Reject explicit non-http(s) schemes BEFORE the prepend step. Without
  // this guard, "mailto:user@example.com" survives: prepending "https://"
  // turns it into "https://mailto:user@example.com", which `new URL()`
  // happily parses as protocol="https:" with hostname="example.com" —
  // bypassing the protocol check below. Same hazard for `ftp:`, `tel:`,
  // `gopher:`, etc. Anything that looks like an explicit non-http scheme
  // is a hard reject.
  const isHttpScheme = /^https?:\/\//i.test(trimmed);
  const hasExplicitScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed);
  if (hasExplicitScheme && !isHttpScheme) return null;

  let candidate = trimmed;
  if (!isHttpScheme) {
    // Handle protocol-relative ("//example.com") and bare-host inputs.
    candidate = candidate.startsWith("//") ? `https:${candidate}` : `https://${candidate}`;
  }

  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!url.hostname || !url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Normalize a GitHub repo URL to its canonical form: `https://github.com/{owner}/{repo}`.
 *
 * Returns `null` if the input doesn't parse as a GitHub repo URL via the
 * existing `parseGithubRepoUrl` validator. This is the helper render sites
 * should use for `project.github_url` so the link is always canonical and
 * never accidentally relative.
 *
 * For non-GitHub external links (live_url, social_links.website), use
 * `normalizeExternalUrl` instead.
 */
export function normalizeRepoUrl(
  input: string | null | undefined,
): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // First pass: prepend https:// if missing so parseGithubRepoUrl's
  // `^https?://` requirement is satisfied for bare-domain inputs.
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const parsed = parseGithubRepoUrl(withProtocol);
  if (!parsed) return null;
  return `https://github.com/${parsed.owner}/${parsed.repo}`;
}
