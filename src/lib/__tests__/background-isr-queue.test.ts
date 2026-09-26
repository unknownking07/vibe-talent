import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  waitUntil: vi.fn(),
  send: vi.fn(),
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => ({ ctx: { waitUntil: mocks.waitUntil } }),
}));
vi.mock("@opennextjs/cloudflare/overrides/queue/do-queue", () => ({
  default: { name: "durable-queue", send: mocks.send },
}));

import backgroundIsrQueue from "@/lib/cloudflare/background-isr-queue";

const message = {
  MessageDeduplicationId: "profile-alice-1",
  MessageBody: {
    host: "www.vibetalent.work",
    url: "/profile/alice",
    lastModified: 1,
    eTag: "etag",
  },
  MessageGroupId: "profile-alice",
};

describe("background ISR queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the stale response path before Durable Object acknowledgement", async () => {
    let acknowledge!: () => void;
    const pending = new Promise<void>((resolve) => { acknowledge = resolve; });
    mocks.send.mockReturnValue(pending);

    await expect(backgroundIsrQueue.send(message)).resolves.toBeUndefined();
    expect(mocks.send).toHaveBeenCalledWith(message);
    expect(mocks.waitUntil).toHaveBeenCalledOnce();

    acknowledge();
    await mocks.waitUntil.mock.calls[0][0];
  });

  it("observes enqueue failures without rejecting the page response", async () => {
    const error = new Error("queue unavailable");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.send.mockRejectedValue(error);

    await expect(backgroundIsrQueue.send(message)).resolves.toBeUndefined();
    await mocks.waitUntil.mock.calls[0][0];
    expect(log).toHaveBeenCalledWith(
      "[isr] failed to enqueue stale page revalidation",
      error,
    );
    log.mockRestore();
  });
});
