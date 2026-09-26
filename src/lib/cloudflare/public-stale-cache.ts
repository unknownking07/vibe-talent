import { getCloudflareContext } from "@opennextjs/cloudflare";
import type {
  CacheEntryType,
  CacheValue,
  IncrementalCache,
  WithLastModified,
} from "@opennextjs/aws/types/overrides";

// Cloudflare's Cache API is per colo. Keep a copy long enough for a returning
// visitor the next morning; Next still decides freshness from lastModified and
// revalidate, and the Durable Object refreshes stale entries in the background.
const STALE_COPY_SECONDS = 24 * 60 * 60;
const CACHE_NAME = "public-stale-isr";

function isPublicDocument(key: string, cacheType?: CacheEntryType): boolean {
  if (cacheType && cacheType !== "cache") return false;
  const pathname = `/${key.replace(/^\/+/, "")}`.replace(/\/+$/, "") || "/";
  return pathname === "/" || /^\/profile\/[^/]+(?:\/projects)?$/.test(pathname);
}

function cacheKey(key: string): string {
  const buildId = process.env.OPEN_NEXT_BUILD_ID ?? "unknown-build";
  return `https://cache.local/${CACHE_NAME}/${encodeURIComponent(buildId)}/${encodeURIComponent(key)}`;
}

async function putCopy(key: string, entry: unknown): Promise<void> {
  const cache = await caches.open(CACHE_NAME);
  await cache.put(cacheKey(key), new Response(JSON.stringify(entry), {
    headers: { "cache-control": `public, max-age=${STALE_COPY_SECONDS}` },
  }));
}

/**
 * The stock regional cache expires its local entry at the page's revalidate
 * interval (60 seconds here), forcing the first stale request through KV.
 * That KV miss was taking 2–20 seconds in production. This public-only copy
 * supplies the same stale entry locally while OpenNext's normal cache and tag
 * logic decide whether it needs revalidation.
 */
export function withPublicStaleCache(base: IncrementalCache): IncrementalCache {
  return {
    name: `public-stale-${base.name}`,
    async get<CacheType extends CacheEntryType = "cache">(
      key: string,
      cacheType?: CacheType,
    ): Promise<WithLastModified<CacheValue<CacheType>> | null> {
      if (!isPublicDocument(key, cacheType)) return base.get(key, cacheType);

      try {
        const cache = await caches.open(CACHE_NAME);
        const hit = await cache.match(cacheKey(key));
        if (hit) {
          const cached = await hit.json() as WithLastModified<CacheValue<CacheType>> | null;
          // A revalidation in another colo may have written a newer KV entry.
          // Refresh this local copy without putting that read on the response path.
          getCloudflareContext().ctx.waitUntil(
            base.get(key, cacheType).then(async (fresh) => {
              if (fresh && (!cached || (fresh.lastModified ?? 0) > (cached.lastModified ?? 0))) {
                await putCopy(key, fresh);
              }
            }).catch((error: unknown) => {
              console.error("[isr] failed to refresh regional stale copy", error);
            }),
          );
          return cached;
        }
      } catch (error) {
        console.error("[isr] failed to read regional stale copy", error);
      }

      const fresh = await base.get(key, cacheType);
      if (fresh) {
        getCloudflareContext().ctx.waitUntil(
          putCopy(key, fresh).catch((error: unknown) => {
            console.error("[isr] failed to store regional stale copy", error);
          }),
        );
      }
      return fresh;
    },
    async set(key, value, cacheType) {
      await base.set(key, value, cacheType);
      if (isPublicDocument(key, cacheType)) {
        getCloudflareContext().ctx.waitUntil(
          putCopy(key, { value, lastModified: Date.now() }).catch((error: unknown) => {
            console.error("[isr] failed to update regional stale copy", error);
          }),
        );
      }
    },
    async delete(key) {
      await base.delete(key);
      if (isPublicDocument(key)) {
        const cache = await caches.open(CACHE_NAME);
        await cache.delete(cacheKey(key));
      }
    },
  };
}
