import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import kvIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache";
import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue";
import d1NextTagCache from "@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache";

// OpenNext (Cloudflare) cache configuration.
// - incrementalCache: KV      -> stores ISR output (`export const revalidate`).
// - queue:            DO queue -> processes time-based ISR revalidations (required
//                                 for time-based revalidate; DO = production-grade).
// - tagCache:         D1       -> backs revalidateTag / revalidatePath.
// Bindings are declared in wrangler.jsonc (NEXT_INC_CACHE_KV, NEXT_CACHE_DO_QUEUE,
// NEXT_TAG_CACHE_D1, WORKER_SELF_REFERENCE).
export default defineCloudflareConfig({
  incrementalCache: kvIncrementalCache,
  queue: doQueue,
  tagCache: d1NextTagCache,
});
