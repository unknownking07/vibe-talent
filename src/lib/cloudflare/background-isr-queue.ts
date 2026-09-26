import { getCloudflareContext } from "@opennextjs/cloudflare";
import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue";

/**
 * OpenNext awaits queue.send() before returning a stale ISR document. The
 * Durable Object can wait behind other revalidations, so that acknowledgement
 * made the first request after expiry take seconds even though stale HTML was
 * already available. Keep the enqueue alive with waitUntil, off the response
 * path; the Durable Object still owns deduplication and the actual render.
 */
const backgroundIsrQueue = {
  name: "background-durable-queue",
  send(message: Parameters<typeof doQueue.send>[0]): Promise<void> {
    getCloudflareContext().ctx.waitUntil(
      doQueue.send(message).catch((error: unknown) => {
        console.error("[isr] failed to enqueue stale page revalidation", error);
      }),
    );
    return Promise.resolve();
  },
};

export default backgroundIsrQueue;
