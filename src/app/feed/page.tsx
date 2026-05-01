import { NetworkFeed } from "@/components/feed/network-feed";
import {
  fetchFullFeedCached,
  fetchFeedStatsCached,
  type FeedNetworkStats,
} from "@/lib/homepage-feed";
import type { FeedItem } from "@/components/feed/feed-types";

/**
 * Full Live Network Feed page.
 *
 * Server-renders the initial feed + right-rail stats so first paint already
 * has data — the page used to be a client shell that flashed "Loading
 * feed..." until a client-side fetch resolved. NetworkFeed still polls
 * /api/feed every 30s so live activity surfaces between SSR renders, but
 * the polling kicks in *after* the page is interactive.
 *
 * Both fetchers share a 60s `unstable_cache` window with the homepage
 * feed (separate keys so a stat-query failure can't poison the feed cache
 * and vice versa) — once warm, the page renders in single-digit ms.
 */
export const revalidate = 60;

export default async function FeedPage() {
  // Run feed + stats in parallel. allSettled means a stats failure can't
  // strand the feed (and vice versa) — each side degrades to its own
  // empty default and the client polling will refresh on its next tick.
  const [feedResult, statsResult] = await Promise.allSettled([
    fetchFullFeedCached(),
    fetchFeedStatsCached(),
  ]);

  const initialItems: FeedItem[] =
    feedResult.status === "fulfilled" ? feedResult.value : [];
  const initialStats: FeedNetworkStats | null =
    statsResult.status === "fulfilled" ? statsResult.value : null;

  if (feedResult.status === "rejected") {
    console.error("[FeedPage] Failed to fetch initial feed:", feedResult.reason);
  }
  if (statsResult.status === "rejected") {
    console.error("[FeedPage] Failed to fetch network stats:", statsResult.reason);
  }

  return (
    <NetworkFeed
      variant="full"
      initialItems={initialItems}
      initialStats={initialStats}
    />
  );
}
