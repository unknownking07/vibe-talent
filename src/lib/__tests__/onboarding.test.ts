/**
 * Onboarding helpers + tour-card integrity tests.
 *
 * Two test files' worth of concerns are bundled here because they share
 * setup and the surface is small. We deliberately avoid mounting the React
 * component — `@testing-library/react` is not installed (and adding it
 * violates the "no new heavy dependencies" constraint), so the modal itself
 * is verified manually via the browser checklist.
 *
 * jsdom provides `window`/`localStorage`/`sessionStorage` per vitest.config.ts.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  STORAGE_KEY,
  SESSION_KEY,
  armTourTrigger,
  consumeTourTrigger,
  hasTourBeenSeen,
  markTourSeen,
  resetTourForReplay,
  safeLocalStorage,
  safeSessionStorage,
} from "../onboarding";
import { TOUR_CARDS, resolveCtaHref } from "../../components/onboarding/tour-cards";

beforeEach(() => {
  // Wipe both stores before every test — `markTourSeen` and friends share
  // process-global storage in jsdom, so leaks between tests would show up
  // as flaky pass/fail ordering.
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe("markTourSeen / hasTourBeenSeen", () => {
  it("hasTourBeenSeen returns false when key absent", () => {
    expect(hasTourBeenSeen()).toBe(false);
  });

  it("markTourSeen writes a numeric timestamp under the versioned key", () => {
    markTourSeen();
    const raw = window.localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(Number.isFinite(Number(raw))).toBe(true);
    expect(Number(raw)).toBeGreaterThan(0);
  });

  it("hasTourBeenSeen returns true after markTourSeen", () => {
    markTourSeen();
    expect(hasTourBeenSeen()).toBe(true);
  });
});

describe("session-key arming and consumption", () => {
  it("armTourTrigger sets the session key to '1'", () => {
    armTourTrigger();
    expect(window.sessionStorage.getItem(SESSION_KEY)).toBe("1");
  });

  it("consumeTourTrigger returns true exactly once and clears the key", () => {
    armTourTrigger();
    expect(consumeTourTrigger()).toBe(true);
    expect(consumeTourTrigger()).toBe(false);
    expect(window.sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it("consumeTourTrigger returns false when nothing is armed", () => {
    expect(consumeTourTrigger()).toBe(false);
  });
});

describe("resetTourForReplay", () => {
  it("clears the seen flag and arms the trigger atomically", () => {
    markTourSeen();
    expect(hasTourBeenSeen()).toBe(true);

    resetTourForReplay();
    expect(hasTourBeenSeen()).toBe(false);
    expect(window.sessionStorage.getItem(SESSION_KEY)).toBe("1");
  });
});

describe("safeLocalStorage / safeSessionStorage", () => {
  // Snapshot the originals so the throw-mocking tests can restore them.
  // Without this, a failed test mid-suite would leave Storage.prototype
  // patched and break every subsequent test.
  const originalGet = Storage.prototype.getItem;
  const originalSet = Storage.prototype.setItem;
  const originalRemove = Storage.prototype.removeItem;

  afterEach(() => {
    Storage.prototype.getItem = originalGet;
    Storage.prototype.setItem = originalSet;
    Storage.prototype.removeItem = originalRemove;
  });

  it("getItem returns null when localStorage throws", () => {
    Storage.prototype.getItem = vi.fn(() => {
      throw new Error("SecurityError: Safari private mode");
    });
    expect(safeLocalStorage.getItem("anything")).toBeNull();
  });

  it("setItem swallows quota-exceeded errors", () => {
    Storage.prototype.setItem = vi.fn(() => {
      throw new Error("QuotaExceededError");
    });
    // Must not throw.
    expect(() => safeLocalStorage.setItem("k", "v")).not.toThrow();
  });

  it("removeItem swallows errors", () => {
    Storage.prototype.removeItem = vi.fn(() => {
      throw new Error("DOMException");
    });
    expect(() => safeLocalStorage.removeItem("k")).not.toThrow();
  });

  it("session storage helpers behave the same", () => {
    Storage.prototype.getItem = vi.fn(() => {
      throw new Error("nope");
    });
    expect(safeSessionStorage.getItem("k")).toBeNull();
  });
});

describe("TOUR_CARDS integrity", () => {
  it("contains exactly 10 cards", () => {
    // If we trim or expand the tour, update both this assertion and the plan.
    // The number is part of the user-facing "N of 10" label so it's not just
    // a vibe check — drift here visibly breaks the UI.
    expect(TOUR_CARDS).toHaveLength(10);
  });

  it("every card has non-empty title, body, ctaLabel, and a learnMore URL", () => {
    for (const card of TOUR_CARDS) {
      expect(card.title.trim().length).toBeGreaterThan(0);
      expect(card.body.trim().length).toBeGreaterThan(0);
      expect(card.ctaLabel.trim().length).toBeGreaterThan(0);
      expect(card.learnMoreHref.startsWith("https://")).toBe(true);
    }
  });

  it("body copy stays under 200 chars so it fits a mobile card without scrolling", () => {
    for (const card of TOUR_CARDS) {
      expect(card.body.length).toBeLessThanOrEqual(200);
    }
  });

  it("every ctaHref is null, an internal path, or a function", () => {
    for (const card of TOUR_CARDS) {
      const href = card.ctaHref;
      const valid =
        href === null ||
        typeof href === "function" ||
        (typeof href === "string" && href.startsWith("/"));
      expect(valid).toBe(true);
    }
  });
});

describe("resolveCtaHref", () => {
  it("returns null when target is null", () => {
    expect(resolveCtaHref(null, "abhi")).toBeNull();
  });

  it("returns the static path unchanged", () => {
    expect(resolveCtaHref("/leaderboard", "abhi")).toBe("/leaderboard");
  });

  it("invokes function targets with the username", () => {
    expect(resolveCtaHref((u) => `/profile/${u}`, "abhi")).toBe("/profile/abhi");
  });

  it("falls back to /dashboard when a function target lacks a username", () => {
    expect(resolveCtaHref((u) => `/profile/${u}`, null)).toBe("/dashboard");
    expect(resolveCtaHref((u) => `/profile/${u}`, undefined)).toBe("/dashboard");
  });
});
