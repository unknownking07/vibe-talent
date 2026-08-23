import { describe, it, expect, afterEach, vi } from "vitest";

import {
  summarizeFocus,
  focusLabel,
  fetchBuilderFocus,
} from "@/lib/builder-focus";

/** n push events against `repo`. */
function pushes(repo: string, n: number) {
  return Array.from({ length: n }, () => ({
    type: "PushEvent",
    repo: { name: repo },
  }));
}

describe("summarizeFocus", () => {
  it("reports the share of pushes in the busiest repo", () => {
    const signal = summarizeFocus([
      ...pushes("me/product", 8),
      ...pushes("me/side", 2),
    ]);
    expect(signal).toMatchObject({
      concentration: 80,
      repoCount: 2,
      pushes: 10,
      topRepo: "me/product",
      sufficient: true,
    });
  });

  it("separates the scattered builder from the focused one at equal volume", () => {
    // The whole point: both did 12 pushes, and vibe_score cannot tell them
    // apart because it only counts the total.
    const focused = summarizeFocus(pushes("me/product", 12));
    const scattered = summarizeFocus(
      Array.from({ length: 12 }, (_, i) => pushes(`me/repo-${i}`, 1)).flat(),
    );

    expect(focused.pushes).toBe(scattered.pushes);
    expect(focused.concentration).toBe(100);
    expect(scattered.concentration).toBe(8);
    expect(focusLabel(focused)).toBe("Focused");
    expect(focusLabel(scattered)).toBe("Spread thin");
  });

  it("counts events rather than commits inside them", () => {
    // A push carrying forty commits must not outweigh sustained work: the
    // payload's commit array is deliberately ignored.
    const signal = summarizeFocus([
      { type: "PushEvent", repo: { name: "me/one-big-merge" } },
      ...pushes("me/product", 4),
    ]);
    expect(signal.topRepo).toBe("me/product");
    expect(signal.concentration).toBe(80);
  });

  it("ignores events that are not pushes", () => {
    const signal = summarizeFocus([
      { type: "WatchEvent", repo: { name: "someone/starred" } },
      { type: "ForkEvent", repo: { name: "someone/forked" } },
      ...pushes("me/product", 6),
    ]);
    expect(signal).toMatchObject({ repoCount: 1, pushes: 6 });
  });

  it("skips malformed entries instead of dropping the series", () => {
    const signal = summarizeFocus([
      { type: "PushEvent" },
      { type: "PushEvent", repo: null },
      { type: "PushEvent", repo: { name: "   " } },
      ...pushes("me/product", 5),
    ]);
    expect(signal.pushes).toBe(5);
  });

  it("withholds a label when the sample is too thin to mean anything", () => {
    const signal = summarizeFocus(pushes("me/product", 4));
    expect(signal.sufficient).toBe(false);
    expect(focusLabel(signal)).toBeNull();
  });

  it("says nothing at all about a builder with no recent pushes", () => {
    const signal = summarizeFocus([]);
    expect(signal).toMatchObject({
      pushes: 0,
      topRepo: null,
      sufficient: false,
    });
    expect(focusLabel(signal)).toBeNull();
  });

  it("resolves ties deterministically, so the same input renders the same repo", () => {
    const a = summarizeFocus([...pushes("me/bbb", 3), ...pushes("me/aaa", 3)]);
    const b = summarizeFocus([...pushes("me/aaa", 3), ...pushes("me/bbb", 3)]);
    expect(a.topRepo).toBe(b.topRepo);
  });
});

describe("focusLabel bands", () => {
  const at = (concentration: number) =>
    focusLabel({
      concentration,
      repoCount: 3,
      pushes: 20,
      topRepo: "x/y",
      sufficient: true,
    });

  it("bands coarsely, because one page of events is a noisy measurement", () => {
    expect(at(100)).toBe("Focused");
    expect(at(70)).toBe("Focused");
    expect(at(69)).toBe("Split");
    expect(at(40)).toBe("Split");
    expect(at(39)).toBe("Spread thin");
  });
});

describe("fetchBuilderFocus", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("summarises what GitHub returns", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({
          ok: true,
          json: async () => pushes("me/product", 9),
        }),
    );
    const signal = await fetchBuilderFocus("me");
    expect(signal).toMatchObject({ concentration: 100, pushes: 9 });
  });

  it("returns null rather than throwing when GitHub refuses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 403 }),
    );
    expect(await fetchBuilderFocus("me")).toBeNull();
  });

  it("returns null when the network fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await fetchBuilderFocus("me")).toBeNull();
  });

  it("does not call out for an empty handle", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchBuilderFocus("  ")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
