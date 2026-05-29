/**
 * Shared helpers for the Live Network Feed, used by both the server-side
 * fetcher (`homepage-feed.ts`) and the client-polled API route
 * (`api/feed/route.ts`). Keeping these in one place guarantees the homepage
 * feed and the /feed page anonymize private activity identically.
 */

/**
 * Replacement message text for a private-repo feed event when the owner has
 * opted into sharing activity. Intentionally generic — no repo name, no
 * commit subject, no file paths, no clickable URL. Even the verb is kept
 * fuzzy so commit cadence can't be back-derived.
 */
export function anonymizePrivateEventMessage(
  eventType: string | null | undefined
): string {
  switch (eventType) {
    case "pr":
      return "opened a pull request in a private repo";
    case "create":
      return "made changes in a private repo";
    case "issue":
      return "opened an issue in a private repo";
    case "push":
    default:
      return "pushed to a private repo";
  }
}
