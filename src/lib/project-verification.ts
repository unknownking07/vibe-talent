/** Stable credentials only: GitHub handles can be renamed and reclaimed. */
export function verificationFileMatches(
  content: string,
  userId: string,
): boolean {
  return content.split(/\r?\n/).some((line) => line.trim() === userId);
}

/** Prove control using GitHub's immutable owner ID or a repository file that
 * explicitly names the VibeTalent account UUID. Plain usernames are unsafe. */
export async function repositoryControlVerified(
  owner: string,
  repo: string,
  repositoryOwnerId: number | null | undefined,
  providerId: number | null | undefined,
  userId: string,
  token?: string,
): Promise<boolean> {
  if (
    Number.isSafeInteger(providerId) &&
    (providerId ?? 0) > 0 &&
    providerId === repositoryOwnerId
  )
    return true;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "VibeTalent-Verification",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  // A transport/rate-limit failure is unknown, not proof of lost ownership.
  // Let callers preserve existing evidence and retry instead of revoking it.
  const response = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/.vibetalent`,
    { headers, signal: AbortSignal.timeout(10000) },
  );
  if (response.status === 404) return false;
  if (!response.ok)
    throw new Error(`Repository proof lookup failed: HTTP ${response.status}`);
  const data = await response.json();
  if (typeof data.content !== "string" || data.encoding !== "base64")
    return false;
  return verificationFileMatches(atob(data.content.replace(/\s/g, "")), userId);
}
