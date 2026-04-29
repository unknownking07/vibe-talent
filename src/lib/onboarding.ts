/**
 * Onboarding tour state, persistence, and feature-flag helpers.
 *
 * Why a dedicated module: every entry point (the modal itself, dashboard mount,
 * profile-setup trigger, navbar replay button) needs to agree on the same
 * storage keys, env-var name, and try/catch behavior. Centralising the surface
 * here keeps those callers honest and gives Vitest a clean import target.
 *
 * Storage keys are versioned (`_v1`) so we can re-trigger the tour for every
 * user simply by bumping the suffix in a future revision — no DB migration,
 * no maintenance flag.
 */

export const STORAGE_KEY = "vibetalent_onboarding_tour_seen_v1";
export const SESSION_KEY = "vibetalent_show_tour_after_redirect";

/**
 * Strict-equality check against the literal string `"true"`. We intentionally
 * reject `"1"`, `"yes"`, etc. so the value is unambiguous in `.env.local` and
 * Vercel's UI — there is exactly one way to enable this feature.
 */
export const TOUR_FLAG_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_ONBOARDING_TOUR === "true";

/**
 * Wrapper around `localStorage` and `sessionStorage` access that survives:
 *  - SSR (no `window`)
 *  - Safari private mode (throws SecurityError on access)
 *  - sandboxed iframes (throws DOMException)
 *  - quota exhaustion on `setItem`
 *
 * All methods are no-ops or return `null` on failure. Callers must treat
 * persistence as best-effort: the tour still functions if storage is dead,
 * the user just sees it again on their next session.
 */
function makeSafeStorage(getStore: () => Storage | null) {
  return {
    getItem(key: string): string | null {
      try {
        const store = getStore();
        return store ? store.getItem(key) : null;
      } catch {
        return null;
      }
    },
    setItem(key: string, value: string): void {
      try {
        const store = getStore();
        if (store) store.setItem(key, value);
      } catch {
        // Quota exceeded, private mode, etc. — swallow.
      }
    },
    removeItem(key: string): void {
      try {
        const store = getStore();
        if (store) store.removeItem(key);
      } catch {
        // Same swallow rationale as setItem.
      }
    },
  };
}

export const safeLocalStorage = makeSafeStorage(() =>
  typeof window === "undefined" ? null : window.localStorage
);

export const safeSessionStorage = makeSafeStorage(() =>
  typeof window === "undefined" ? null : window.sessionStorage
);

/**
 * Mark the tour as seen. Stores a timestamp string so we have telemetry-grade
 * "when did this happen" data without needing a full event-tracking pipeline.
 */
export function markTourSeen(): void {
  safeLocalStorage.setItem(STORAGE_KEY, Date.now().toString());
}

export function hasTourBeenSeen(): boolean {
  return safeLocalStorage.getItem(STORAGE_KEY) !== null;
}

/**
 * Called by both the post-signup flow (profile-setup step 4) and the navbar
 * "Replay tour" button. Centralised so the trigger contract has exactly one
 * implementation — keeping these in sync by hand is how bugs sneak in.
 */
export function armTourTrigger(): void {
  safeSessionStorage.setItem(SESSION_KEY, "1");
}

/**
 * Read-and-clear: returns true exactly once per arming. The dashboard calls
 * this on mount; subsequent reloads in the same tab will return false because
 * we delete the key as we read it.
 */
export function consumeTourTrigger(): boolean {
  const value = safeSessionStorage.getItem(SESSION_KEY);
  if (value === "1") {
    safeSessionStorage.removeItem(SESSION_KEY);
    return true;
  }
  return false;
}

/**
 * Replay path: clear the seen flag, arm the trigger, let the caller route to
 * `/dashboard`. Single function so the navbar doesn't need to know about
 * either storage key directly.
 */
export function resetTourForReplay(): void {
  safeLocalStorage.removeItem(STORAGE_KEY);
  armTourTrigger();
}
