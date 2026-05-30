// Admin allowlist, kept in one server-importable place so API routes can
// authorize against the session. The client-side admin page imports this too,
// but a client check is only cosmetic — the server is the trust boundary, so
// every privileged endpoint must re-check with isAdminUsername() server-side.
export const ADMIN_USERNAMES = ["unknownking07", "stuart5915"];

export function isAdminUsername(username: string | null | undefined): boolean {
  return !!username && ADMIN_USERNAMES.includes(username.toLowerCase());
}
