import { NetworkFeed } from "@/components/feed/network-feed";

/**
 * Full Live Network Feed page.
 *
 * The feed UI lives in `<NetworkFeed>` so the homepage's compact variant
 * shares the same row renderer and the same data shape — when a new event
 * type is added to the API, both surfaces pick it up automatically.
 */
export default function FeedPage() {
  return <NetworkFeed variant="full" />;
}
