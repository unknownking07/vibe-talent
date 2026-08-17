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

/** Longest derived candidate before the collision suffix is appended. */
const MAX_SEED_LENGTH = 20;

/**
 * Normalize what someone types into a username field, live.
 *
 * Separators (whitespace, dots, hyphens) become underscores instead of being
 * deleted. The previous filter dropped them outright, so typing a real name
 * made characters vanish mid-keystroke ("Abhinav K" → "abhinavk") and read as
 * a broken input rather than as validation.
 *
 * Deliberately does NOT collapse or trim underscores — doing that on every
 * keystroke fights someone typing a deliberate `a__b`. Tidying is
 * `sanitizeUsernameSeed`'s job, and it only runs on derived candidates.
 */
export function normalizeUsernameInput(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[\s.\-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

/**
 * Turn a piece of identity text (GitHub handle, email local-part, display
 * name) into a username candidate, or "" if nothing usable survives.
 *
 * Unlike `normalizeUsernameInput` this tidies aggressively — collapse repeated
 * underscores, trim the ends, cap the length — because the result is proposed
 * to the user rather than typed by them.
 */
export function sanitizeUsernameSeed(raw: string | null | undefined): string {
  if (!raw) return "";
  const seed = normalizeUsernameInput(String(raw))
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, MAX_SEED_LENGTH)
    // The slice can re-expose a trailing underscore ("abhinav_kumar_x" → "…_").
    .replace(/_+$/, "");
  return validateUsername(seed) === null ? seed : "";
}

/**
 * Pick the first free username from ordered identity `seeds` (most preferred
 * first), so onboarding can pre-fill its one required field instead of showing
 * a blank box.
 *
 * Tries every bare candidate before falling back to numeric suffixes on the
 * preferred one — `abhinavk` (their email handle) beats `abhinav_2`. Returns
 * null when no seed yields anything usable; the caller then leaves the field
 * empty, exactly as before.
 *
 * On a lookup failure it returns the preferred candidate rather than null: a
 * pre-filled handle that *might* collide still beats a blank required field,
 * and the unique constraint catches a real clash on submit with a clear,
 * recoverable "already taken" message.
 */
export async function suggestAvailableUsername(
  client: UsernameLookupClient,
  seeds: (string | null | undefined)[],
  opts: { maxSuffix?: number } = {}
): Promise<string | null> {
  const { maxSuffix = 5 } = opts;
  const bases = [...new Set(seeds.map(sanitizeUsernameSeed).filter(Boolean))];
  if (bases.length === 0) return null;

  const attempts = [...bases];
  for (let n = 2; n <= maxSuffix; n++) attempts.push(`${bases[0]}_${n}`);

  for (const candidate of attempts) {
    const { available, error } = await checkUsernameAvailable(client, candidate);
    if (error) return bases[0];
    if (available) return candidate;
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
