/**
 * Onboarding `users`-row persistence.
 *
 * Split out from the profile-setup page so the create-or-update write has a
 * single implementation and a clean Vitest import target (the page component
 * itself isn't mounted in tests — see onboarding.test.ts for that rationale).
 */

/**
 * Columns a client may write on its own `users` row during onboarding.
 *
 * Mirrors the column-level UPDATE grant added in migration
 * `20260529_security_hardening_rls` — keep the two in lock-step. `id` is
 * deliberately absent: it's the primary key and the RLS scoping column, never a
 * client-writable field.
 */
export interface OnboardingProfileFields {
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url?: string;
  github_username?: string;
  github_id?: number;
}

/**
 * Structural slice of the supabase-js client covering only the calls this
 * helper makes. Typed loosely on purpose — the real client is generic over the
 * DB schema and the page already reaches it through `as any` because the
 * generated `Database` types lag the newer profile columns — so tests can pass
 * a light fake without rebuilding the full query-builder surface.
 */
export interface ProfileWriteClient {
  from(table: "users"): {
    update(values: OnboardingProfileFields): {
      eq(
        column: "id",
        value: string
      ): {
        select(columns: string): PromiseLike<{
          data: unknown[] | null;
          error: unknown;
        }>;
      };
    };
    insert(
      values: OnboardingProfileFields & { id: string }
    ): PromiseLike<{ error: unknown }>;
  };
}

/** Pull the SQLSTATE code off a Postgrest-style error object, if present. */
function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? (error as { code?: string }).code
    : undefined;
}

/**
 * Create or update the caller's `users` row during onboarding WITHOUT a
 * PostgREST upsert.
 *
 * The obvious `.upsert({ id, ... }, { onConflict: "id" })` is a trap here:
 * PostgREST compiles it to
 *   `INSERT ... ON CONFLICT (id) DO UPDATE SET id = EXCLUDED.id, username = ...`
 * i.e. the conflict-target `id` lands in the UPDATE SET list. Migration
 * `20260529_security_hardening_rls` revoked table-level UPDATE on `users` and
 * re-granted column-level UPDATE on only the editable profile columns (not
 * `id`), so the ON CONFLICT branch — taken whenever the row already exists —
 * fails with `42501 permission denied for table users`. That's the
 * "Failed to save profile" an existing user hits on the username step.
 *
 * Splitting the write keeps `id` out of every SET clause:
 *   1. UPDATE the existing row (granted columns only; `id` is just the filter).
 *   2. If no row matched, it's a brand-new signup → INSERT (the `id` column is
 *      fine on an INSERT — no UPDATE grant is consulted). If a concurrent
 *      request wins the insert first, that's a 23505 on the `id` PK — we
 *      converge by retrying the UPDATE rather than failing onboarding.
 *
 * Throws the underlying Postgrest error so the caller's existing try/catch can
 * surface it (including a genuine username-uniqueness collision).
 */
export async function saveOnboardingProfile(
  client: ProfileWriteClient,
  id: string,
  fields: OnboardingProfileFields
): Promise<void> {
  // Existing user → UPDATE only the granted profile columns. `id` stays in the
  // WHERE filter, never in the SET list. `.select("id")` lets us tell an
  // updated row apart from "no row matched yet".
  const { data: updated, error: updateError } = await client
    .from("users")
    .update(fields)
    .eq("id", id)
    .select("id");
  if (updateError) throw updateError;

  // No row matched → brand-new signup. Create it. INSERT (not UPDATE) so the
  // locked-down UPDATE grant on `id` is irrelevant.
  if (!updated || updated.length === 0) {
    const { error: insertError } = await client
      .from("users")
      .insert({ id, ...fields });
    if (!insertError) return;

    // A unique violation (23505) here is ambiguous. Either:
    //   (a) a concurrent request created THIS row between our UPDATE and INSERT
    //       (conflict on the `id` primary key) → converge by UPDATE-ing it, or
    //   (b) the chosen username belongs to a different user (conflict on the
    //       username unique index) → a real error the user must see.
    // Retrying the UPDATE disambiguates without parsing constraint names: if it
    // now matches our row the race resolved; if it matches nothing, the row for
    // this id still doesn't exist, so the conflict was the username — re-throw
    // so the caller surfaces "Failed to save profile" rather than silently
    // sending the user onward with no row.
    if (errorCode(insertError) !== "23505") throw insertError;

    const { data: retried, error: retryError } = await client
      .from("users")
      .update(fields)
      .eq("id", id)
      .select("id");
    if (retryError) throw retryError;
    if (!retried || retried.length === 0) throw insertError;
  }
}
