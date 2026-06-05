"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  checkUsernameAvailable,
  validateUsername,
  type UsernameLookupClient,
} from "@/lib/username";

export type UsernameStatus =
  | "idle" // empty, or unchanged from the current handle
  | "invalid" // fails the format rule
  | "checking" // availability lookup in flight
  | "available"
  | "taken"
  | "error"; // lookup failed — don't hard-block; the on-submit constraint decides

export interface UsernameAvailability {
  status: UsernameStatus;
  message: string | null;
}

/**
 * Debounced live username availability for the profile-setup and settings
 * fields. Validates format first, then queries `users` for a clash.
 *
 * The synchronous statuses (idle / invalid / checking) are DERIVED during
 * render — only the async lookup result is stored in state, and that `setState`
 * runs inside the debounced callback, never synchronously in the effect (which
 * would cascade renders). Stale lookups are dropped via a request token tagged
 * onto the result, and failures degrade to `error` (never throw) so a flaky
 * check never blocks a legitimate submit — the unique constraint stays the
 * authoritative, race-proof gate.
 *
 * `currentUsername` (settings): the user's existing handle — unchanged input is
 * `idle`, never a redundant "taken". `currentUserId`: treats their own row as
 * available if the query happens to return it.
 */
export function useUsernameAvailability(
  username: string,
  opts: { currentUsername?: string | null; currentUserId?: string | null } = {}
): UsernameAvailability {
  const { currentUsername, currentUserId } = opts;

  const value = username.trim();
  const unchanged = !value || (currentUsername != null && value === currentUsername);
  const formatError = unchanged ? null : validateUsername(value);
  const checkable = !unchanged && !formatError;

  // Only the async lookup result lives in state, tagged with the value it was
  // computed for so a stale result is ignored when deriving the status below.
  const [result, setResult] = useState<{
    value: string;
    available: boolean | null;
    errored: boolean;
  }>({ value: "", available: null, errored: false });
  const reqId = useRef(0);

  useEffect(() => {
    if (!checkable) return;
    const id = ++reqId.current;
    const timer = setTimeout(async () => {
      try {
        const client = createClient() as unknown as UsernameLookupClient;
        const { available, error } = await checkUsernameAvailable(
          client,
          value,
          currentUserId ?? undefined
        );
        if (id !== reqId.current) return; // a newer keystroke superseded this one
        setResult(
          error
            ? { value, available: null, errored: true }
            : { value, available, errored: false }
        );
      } catch {
        if (id !== reqId.current) return;
        setResult({ value, available: null, errored: true });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [value, checkable, currentUserId]);

  if (unchanged) return { status: "idle", message: null };
  if (formatError) return { status: "invalid", message: formatError };
  if (result.value !== value) return { status: "checking", message: "Checking availability…" };
  if (result.errored) return { status: "error", message: null };
  return result.available
    ? { status: "available", message: "Available" }
    : { status: "taken", message: `@${value} is already taken — try another.` };
}
