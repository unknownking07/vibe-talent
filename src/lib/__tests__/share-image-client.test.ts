import { afterEach, describe, expect, it, vi } from "vitest";
import { getShareImage, prewarmShareImage } from "@/lib/share-image-client";

afterEach(() => vi.unstubAllGlobals());

describe("share image reuse", () => {
  it("uses the hover request for preview, copy, and download", async () => {
    const blob = new Blob(["png"], { type: "image/png" });
    const fetch = vi.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(blob) });
    vi.stubGlobal("fetch", fetch);

    prewarmShareImage("/api/share-card/cache-test");
    const preview = getShareImage("/api/share-card/cache-test");
    const copied = getShareImage("/api/share-card/cache-test");

    expect(preview).toBe(copied);
    expect(await copied).toBe(blob);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("retries after a failed image request", async () => {
    const blob = new Blob(["png"], { type: "image/png" });
    const fetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: true, blob: () => Promise.resolve(blob) });
    vi.stubGlobal("fetch", fetch);

    await expect(getShareImage("/api/share-card/retry-test")).rejects.toThrow("HTTP 500");
    await expect(getShareImage("/api/share-card/retry-test")).resolves.toBe(blob);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
