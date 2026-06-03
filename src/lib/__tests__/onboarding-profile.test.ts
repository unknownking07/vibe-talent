/**
 * Regression tests for the onboarding profile write.
 *
 * The bug (42501 "permission denied for table users"): profile-setup used a
 * PostgREST upsert whose compiled `ON CONFLICT (id) DO UPDATE SET id = ...`
 * needs UPDATE on the `id` column, which the 2026-05-29 hardening migration no
 * longer grants. These tests pin the fix: an UPDATE that never lists `id` in
 * its SET payload, with an INSERT fallback only when no row exists yet.
 *
 * We don't mock the real supabase client — we pass a hand-rolled fake matching
 * the narrow ProfileWriteClient surface and assert on the calls it records.
 */

import { describe, it, expect } from "vitest";
import {
  saveOnboardingProfile,
  type OnboardingProfileFields,
  type ProfileWriteClient,
} from "../onboarding-profile";

interface RecordedUpdate {
  values: OnboardingProfileFields;
  id?: string;
}

/**
 * Build a fake client that records every update/insert and returns the given
 * `updateRows` from `.update().eq().select()`. `[]` ⇒ no row matched (new user);
 * a non-empty array ⇒ the row already existed.
 */
function makeClient(
  updateRows: unknown[] | null,
  errors: { update?: unknown; insert?: unknown } = {},
  // Result for the *retry* UPDATE (2nd+ update call). Defaults to `updateRows`.
  // Used to model the insert-race: 1st UPDATE sees no row, INSERT loses the
  // race (23505), retry UPDATE now finds the row a concurrent request created.
  retryUpdateRows?: unknown[] | null
) {
  const calls = {
    update: [] as RecordedUpdate[],
    insert: [] as (OnboardingProfileFields & { id: string })[],
  };
  let updateCalls = 0;

  const client: ProfileWriteClient = {
    from() {
      return {
        update(values: OnboardingProfileFields) {
          updateCalls += 1;
          const callIndex = updateCalls;
          const recorded: RecordedUpdate = { values };
          calls.update.push(recorded);
          return {
            eq(_column: "id", value: string) {
              recorded.id = value;
              return {
                select() {
                  const data =
                    callIndex === 1 || retryUpdateRows === undefined
                      ? updateRows
                      : retryUpdateRows;
                  return Promise.resolve({
                    data,
                    error: errors.update ?? null,
                  });
                },
              };
            },
          };
        },
        insert(values: OnboardingProfileFields & { id: string }) {
          calls.insert.push(values);
          return Promise.resolve({ error: errors.insert ?? null });
        },
      };
    },
  };

  return { client, calls };
}

const FIELDS: OnboardingProfileFields = {
  username: "rishad",
  display_name: "Rishad N",
  bio: null,
  avatar_url: "https://example.com/a.png",
  github_username: "rishad",
  github_id: 12345,
};

describe("saveOnboardingProfile", () => {
  it("updates the existing row and does not insert", async () => {
    const { client, calls } = makeClient([{ id: "user-1" }]);

    await saveOnboardingProfile(client, "user-1", FIELDS);

    expect(calls.update).toHaveLength(1);
    expect(calls.insert).toHaveLength(0);
    expect(calls.update[0].id).toBe("user-1");
    expect(calls.update[0].values).toMatchObject({ username: "rishad" });
  });

  it("never lists `id` in the UPDATE SET payload (the 42501 regression)", async () => {
    const { client, calls } = makeClient([{ id: "user-1" }]);

    await saveOnboardingProfile(client, "user-1", FIELDS);

    // The whole point of the fix: `id` is the WHERE filter, never a SET column.
    expect("id" in calls.update[0].values).toBe(false);
    expect(calls.update[0].id).toBe("user-1");
  });

  it("inserts a new row (id included) when no row matched yet", async () => {
    const { client, calls } = makeClient([]);

    await saveOnboardingProfile(client, "new-user", FIELDS);

    expect(calls.update).toHaveLength(1);
    expect(calls.insert).toHaveLength(1);
    expect(calls.insert[0]).toMatchObject({ id: "new-user", username: "rishad" });
  });

  it("treats null update data as no-row-matched and falls back to insert", async () => {
    const { client, calls } = makeClient(null);

    await saveOnboardingProfile(client, "new-user", FIELDS);

    expect(calls.insert).toHaveLength(1);
    expect(calls.insert[0]).toMatchObject({ id: "new-user" });
  });

  it("propagates an UPDATE error without attempting an insert", async () => {
    const { client, calls } = makeClient(null, {
      update: { code: "42501", message: "permission denied for table users" },
    });

    await expect(
      saveOnboardingProfile(client, "user-1", FIELDS)
    ).rejects.toMatchObject({ code: "42501" });
    expect(calls.insert).toHaveLength(0);
  });

  it("propagates a non-unique INSERT error without retrying", async () => {
    const { client, calls } = makeClient([], {
      insert: { code: "23502", message: "null value in column violates not-null" },
    });

    await expect(
      saveOnboardingProfile(client, "new-user", FIELDS)
    ).rejects.toMatchObject({ code: "23502" });
    // Only the initial UPDATE — a non-23505 error is not a race, so no retry.
    expect(calls.update).toHaveLength(1);
  });

  it("converges on a concurrent-insert race (23505 on id PK → retry UPDATE finds the row)", async () => {
    // 1st UPDATE: no row. INSERT loses the race (23505). Retry UPDATE: a
    // concurrent request created the row, so it now matches → resolve, no throw.
    const { client, calls } = makeClient(
      [],
      { insert: { code: "23505", message: 'duplicate key value violates unique constraint "users_pkey"' } },
      [{ id: "raced-user" }]
    );

    await expect(
      saveOnboardingProfile(client, "raced-user", FIELDS)
    ).resolves.toBeUndefined();

    expect(calls.insert).toHaveLength(1);
    // Initial UPDATE + the convergence retry.
    expect(calls.update).toHaveLength(2);
    // The retry UPDATE also keeps `id` out of its SET payload.
    expect("id" in calls.update[1].values).toBe(false);
  });

  it("re-throws a username-uniqueness collision (23505, retry UPDATE still finds no row)", async () => {
    // INSERT fails 23505 because the username is taken by ANOTHER user. The
    // retry UPDATE matches no row (this id still has none) → surface the error
    // rather than silently sending the user on with no profile.
    const { client, calls } = makeClient([], {
      insert: {
        code: "23505",
        message: 'duplicate key value violates unique constraint "users_username_key"',
      },
    });

    await expect(
      saveOnboardingProfile(client, "new-user", FIELDS)
    ).rejects.toMatchObject({ code: "23505" });
    expect(calls.update).toHaveLength(2);
  });
});
