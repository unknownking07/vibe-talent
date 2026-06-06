/**
 * Username validation, availability, and error-classification helpers.
 *
 * Centralised so onboarding (profile-setup) and settings agree on the rules and
 * both turn a unique-violation into the same clear, recoverable message instead
 * of a vague "Failed to save profile" (or, in settings, a silent failure).
 */

/** Format rule shared by every place a username is set. Returns an error
 * string, or null when valid. Mirrors the input filter on the username fields
 * (lowercase letters, numbers, underscores; min 3 chars). */
export function validateUsername(value: string): string | null {
  if (value.length < 3) return "Username must be at least 3 characters";
  if (!/^[a-z0-9_]+$/.test(value)) {
    return "Only lowercase letters, numbers, and underscores allowed";
  }
  return null;
}

/**
 * True when `err` is a Postgres unique-violation (23505) on the username
 * constraint — i.e. the handle is already taken. Gated on the SQLSTATE first,
 * then the constraint/column name so it never mistakes the `github_id` unique
 * index (which carries 23505 too) for a username clash.
 */
export function isUsernameTakenError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const code = "code" in err ? (err as { code?: unknown }).code : undefined;
  if (code !== "23505") return false;
  const message = "message" in err ? String((err as { message?: unknown }).message ?? "") : "";
  const details = "details" in err ? String((err as { details?: unknown }).details ?? "") : "";
  return /users_username_key|username/i.test(`${message} ${details}`);
}

/**
 * Minimal structural slice of the supabase-js client for the availability
 * lookup. Typed loosely on purpose (the real client is generic over the DB
 * schema and pages reach it via `as any`) so tests can pass a light fake.
 */
export interface UsernameLookupClient {
  from(table: "users"): {
    select(columns: string): {
      eq(
        column: "username",
        value: string
      ): {
        maybeSingle(): PromiseLike<{
          data: { id: string } | null;
          error: unknown;
        }>;
      };
    };
  };
}

export interface UsernameAvailabilityResult {
  available: boolean;
  /** The lookup failed (network/RLS). Callers should not hard-block on this —
   * the unique constraint is still the source of truth on submit. */
  error: unknown;
}

/**
 * Check whether `username` is free. `currentUserId` (optional) treats the
 * caller's own existing row as "available" so editing settings without changing
 * the handle never reads as taken.
 *
 * On a lookup error, returns `{ available: false, error }` — the caller decides
 * whether to surface it or fall through to the on-submit unique-constraint
 * check (which is authoritative and race-proof).
 */
export async function checkUsernameAvailable(
  client: UsernameLookupClient,
  username: string,
  currentUserId?: string
): Promise<UsernameAvailabilityResult> {
  const { data, error } = await client
    .from("users")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  if (error) return { available: false, error };
  if (!data) return { available: true, error: null };
  // A row exists: free only if it's the caller's own row.
  return { available: currentUserId != null && data.id === currentUserId, error: null };
}
