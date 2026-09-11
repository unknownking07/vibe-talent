// The board is the only way to reach a tracked launch that is not among the
// busiest few, so these cover the two things that can strand one: a page that
// never advances, and controls that are not rendered at all.

import { describe, it, expect, afterEach } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";

import { UnverifiedLaunchBoard } from "@/components/bags/unverified-launch-board";
import type { UnverifiedLaunch } from "@/lib/bags-board";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

/** Mints end in the Bags vanity suffix, as every real one does. */
function makeLaunches(count: number): UnverifiedLaunch[] {
  return Array.from({ length: count }, (_, i) => ({
    mint: `Mint${String(i).padStart(3, "0")}xxxxxxxxxxxxxxxxxxxxxxxxxBAGS`,
    name: `Launch ${i}`,
    symbol: `SYM${i}`,
    imageUrl: null,
    fdvUsd: null,
    volume24hUsd: null,
    bagsUsername: `creator${i}`,
    twitterUsername: null,
    profileUsername: null,
  }));
}

function render(launches: UnverifiedLaunch[]) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root!.render(<UnverifiedLaunchBoard launches={launches} />));
  return container;
}

const rowCount = (el: HTMLElement) => el.querySelectorAll("ul > li").length;
const status = (el: HTMLElement) =>
  el.querySelector("[aria-live]")?.textContent?.replace(/\s+/g, " ").trim();
const search = (el: HTMLElement) =>
  el.querySelector<HTMLInputElement>('input[type="search"]');
const nextButton = (el: HTMLElement) =>
  el.querySelector<HTMLButtonElement>('button[aria-label="Next page"]');

function type(el: HTMLElement, value: string) {
  const input = search(el)!;
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )!.set!;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("UnverifiedLaunchBoard", () => {
  it("shows one page of rows and reports the full count", () => {
    const el = render(makeLaunches(60));
    expect(rowCount(el)).toBe(25);
    expect(status(el)).toBe("1–25 of 60 launches");
  });

  it("pages forward through the rest", () => {
    const el = render(makeLaunches(60));
    act(() => nextButton(el)!.click());
    expect(status(el)).toBe("26–50 of 60 launches");
    act(() => nextButton(el)!.click());
    expect(status(el)).toBe("51–60 of 60 launches");
    expect(rowCount(el)).toBe(10);
    expect(nextButton(el)!.disabled).toBe(true);
  });

  // Regression: search used to be withheld below 26 launches, which left a
  // short-but-not-tiny board with no way to find anything in it.
  it("offers search at the single-page boundary and below", () => {
    for (const count of [1, 24, 25]) {
      const el = render(makeLaunches(count));
      expect(search(el), `${count} launches`).not.toBeNull();
      expect(nextButton(el), `${count} launches`).toBeNull();
      expect(status(el)).toBe(
        `1–${count} of ${count} ${count === 1 ? "launch" : "launches"}`,
      );
      act(() => root!.unmount());
      container!.remove();
    }
  });

  it("filters on a query and resets to the first page", () => {
    const el = render(makeLaunches(60));
    act(() => nextButton(el)!.click());
    expect(status(el)).toBe("26–50 of 60 launches");

    type(el, "Launch 7");
    // "Launch 7" also prefixes nothing else; 7 alone would match 7, 17, 27…
    expect(status(el)).toBe("1–1 of 1 launch matching “Launch 7”");
    expect(rowCount(el)).toBe(1);
  });

  it("explains an empty result rather than rendering a blank list", () => {
    const el = render(makeLaunches(60));
    type(el, "nothing-matches-this");
    expect(rowCount(el)).toBe(0);
    expect(el.textContent).toContain("No tracked launch matches");
    expect(status(el)).toBe("0 launches matching “nothing-matches-this”");
  });

  it("does not match every launch on the shared BAGS mint suffix", () => {
    const el = render(makeLaunches(60));
    type(el, "bags");
    expect(status(el)).toBe("0 launches matching “bags”");
  });
});
