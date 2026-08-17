// Staging gate for features that ship to main but must not be reachable in
// production yet.
//
// IS_STAGING is set to "1" only in wrangler.beta.jsonc (the vibetalent-beta
// Worker behind staging.vibetalent.work). It is absent on the production
// Worker, so anything gated on this can never fire on www.
//
// Server-side only — reading it needs the Cloudflare env. Client components
// must receive the result as a prop from a server component rather than
// calling this directly.

import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Is this request being served by the staging Worker?
 *
 * Falls back to a plain env var so `npm run dev` can exercise staging-gated
 * features locally (set VIBE_STAGING=1 in .env.local). Anything other than
 * exactly "1" is treated as production — this fails CLOSED, because the cost
 * of wrongly returning true is exposing unfinished paid flows on the live site.
 */
export function isStaging(): boolean {
  try {
    const { env } = getCloudflareContext();
    if ((env as { IS_STAGING?: string }).IS_STAGING === "1") return true;
  } catch {
    // Not running on Cloudflare (local dev, tests) — fall through.
  }
  return process.env.VIBE_STAGING === "1";
}

/**
 * Guard for API routes that must not exist in production. Returns a 404 (not a
 * 403) so production gives away nothing about unreleased endpoints.
 */
export function stagingOnlyResponse(): Response | null {
  if (isStaging()) return null;
  return new Response(JSON.stringify({ error: "Not found" }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
}
