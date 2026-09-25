// Only allow same-origin relative paths. Rejects protocol-relative URLs,
// backslashes, embedded schemes, and control characters in redirects.
const CONTROL_CHARS = /[\x00-\x1F\x7F]/;

export function sanitizeNext(raw: string | null): string {
  if (!raw) return "/dashboard";
  if (CONTROL_CHARS.test(raw)) return "/dashboard";
  if (!raw.startsWith("/")) return "/dashboard";
  if (raw.startsWith("//") || raw.startsWith("/\\")) return "/dashboard";
  if (raw.includes("\\")) return "/dashboard";
  return raw;
}
