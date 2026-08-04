import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import kvIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache";
import { withRegionalCache } from "@opennextjs/cloudflare/overrides/incremental-cache/regional-cache";
import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue";
import doShardedTagCache from "@opennextjs/cloudflare/overrides/tag-cache/do-sharded-tag-cache";

// OpenNext (Cloudflare) cache configuration.
// - incrementalCache: KV behind a per-colo Cache API layer -> stores ISR output.
// - queue:            DO queue -> processes time-based ISR revalidations.
// - tagCache:         sharded DO -> backs revalidateTag / revalidatePath.
// Bindings are declared in wrangler.jsonc (NEXT_INC_CACHE_KV, NEXT_CACHE_DO_QUEUE,
// NEXT_TAG_CACHE_DO_SHARDED, WORKER_SELF_REFERENCE).
export default defineCloudflareConfig({
  // A bare Worker invocation on this account answers in ~30ms; a *cache-hit* page
  // took ~330ms. That ~290ms gap was cache-layer I/O leaving the colo on every
  // dynamic response. `withRegionalCache` keeps the ISR entry in the colo's
  // Cache API so a hit stays local.
  //
  // `long-lived` sounds risky but isn't: a regional entry's max-age is the page's
  // own `revalidate` (the 30-minute default only applies to entries that declare
  // none), so the colo copy expires exactly when the ISR window does. On a
  // regional hit OpenNext still refreshes from KV in `waitUntil`, off the
  // response path.
  //
  // Second-order benefit, and the reason this ships with the queue fix: a
  // regional hit is *fresh*, so it does not enqueue a revalidation. That removes
  // most of the triggers that were driving the re-render storm.
  incrementalCache: withRegionalCache(kvIncrementalCache, { mode: "long-lived" }),
  queue: doQueue,
  // Replaces the D1 tag cache. That D1 instance is pinned to ENAM (Newark) with
  // read replication disabled, and OpenNext queries it with plain `prepare()`
  // rather than the Sessions API — so read replicas would not have been used
  // even if enabled. Every dynamic response paid a cross-planet round trip for a
  // query whose own execution time is 0.2ms.
  //
  // `regionalCache` is the point: a hard refresh fires ~30 requests at once, and
  // with it only the first pays the Durable Object hop while the rest read the
  // colo copy. Its 5s default TTL bounds how long a `revalidateTag` takes to
  // show up, comfortably inside what the profile and endorsement flows need.
  tagCache: doShardedTagCache({
    baseShardSize: 4,
    regionalCache: true,
  }),
});
