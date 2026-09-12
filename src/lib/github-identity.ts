// The one place that turns a Supabase auth identity into the GitHub handle the
// rest of the app trusts.
//
// This logic used to live in four copies — /auth/callback, profile-setup,
// dashboard and settings — and they had drifted into two different bugs:
//
//   * dashboard and settings fired their repair writes without awaiting them.
//     A PostgREST builder is lazy (the fetch happens inside `then()`), so an
//     un-awaited query never leaves the browser. Both pages patched their local
//     copy on the next line, so the screen looked repaired while the database
//     was never touched — the failure was invisible by construction.
//   * dashboard and profile-setup derived the handle from `user_metadata`
//     without checking that a GitHub identity was still attached. That metadata
//     survives `unlinkIdentity`, so a builder who disconnected GitHub had the
//     handle written straight back on their next page load.
//
// Keeping both rules in one function is the point: either one alone is wrong.

import type { SupabaseClient, User } from "@supabase/supabase-js";

export type GithubIdentity = {
  username: string;
  /**
   * GitHub's stable numeric id, when the provider sent one. github-sync uses it
   * to tell a legitimate rename apart from someone reclaiming a freed handle,
   * so a missing value silently disables that guard.
   */
  id: number | null;
};

/** What the caller already has in the database, so we only write what is missing. */
export type GithubMirrorState = {
  githubUsername?: string | null;
  githubId?: number | null;
  socialGithub?: string | null;
};

// The pages hold clients typed against generated Database types that disagree
// with each other, so this takes the loosest shape that still names the calls.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MirrorClient = Pick<SupabaseClient<any, any, any>, "from">;

function asHandle(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * The GitHub handle this account has actually proved, or null.
 *
 * Returns null unless a GitHub identity is currently attached, whatever
 * `user_metadata` still remembers. `user_metadata` is only consulted as a
 * fallback *for the handle itself*, because older identities predate Supabase
 * copying `user_name` into `identity_data`.
 */
export function readGithubIdentity(
  user: User | null | undefined,
): GithubIdentity | null {
  const identity = user?.identities?.find((i) => i.provider === "github");
  if (!identity) return null;

  const data = (identity.identity_data ?? {}) as Record<string, unknown>;
  const metadata = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const username =
    asHandle(data.user_name) ??
    asHandle(data.preferred_username) ??
    asHandle(metadata.user_name) ??
    asHandle(metadata.preferred_username);
  if (!username) return null;

  // Lives in identity_data.sub (OIDC-style subject id, string-encoded).
  const raw = data.sub ?? data.provider_id ?? null;
  const parsed =
    raw != null && /^\d+$/.test(String(raw)) ? Number(raw) : Number.NaN;

  return { username, id: Number.isFinite(parsed) ? parsed : null };
}

/**
 * Repair `users.github_username` / `users.github_id` / `social_links.github`
 * from the live identity, and report the handle now in force.
 *
 * Only fills gaps. Reconciling a handle that changed on GitHub's side is
 * github-sync's job — it holds the rename-versus-reclaim guard this does not.
 *
 * A failed write is logged rather than thrown: the caller's page is still
 * usable with the returned handle, and the next load retries. It must never be
 * swallowed silently, which is how the original bug survived.
 */
export async function syncGithubMirrors(
  sb: MirrorClient,
  userId: string,
  user: User | null | undefined,
  current: GithubMirrorState,
): Promise<GithubIdentity | null> {
  const identity = readGithubIdentity(user);
  if (!identity) return null;

  const userUpdates: Record<string, string | number> = {};
  if (!current.githubUsername) userUpdates.github_username = identity.username;
  // Backfilled once and never overwritten: a row that already carries an id has
  // been canonicalised, and the unique partial index would reject a conflict.
  if (current.githubId == null && identity.id !== null) {
    userUpdates.github_id = identity.id;
  }

  if (Object.keys(userUpdates).length > 0) {
    const { error } = await sb.from("users").update(userUpdates).eq("id", userId);
    if (error) {
      console.error("github mirror: users update failed", error.message);
    }
  }

  if (!current.socialGithub) {
    const { error } = await sb
      .from("social_links")
      .upsert(
        { user_id: userId, github: identity.username },
        { onConflict: "user_id" },
      );
    if (error) {
      console.error("github mirror: social_links upsert failed", error.message);
    }
  }

  return identity;
}
