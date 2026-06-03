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
  errors: { update?: unknown; insert?: unknown } = {}
) {
  const calls = {
    update: [] as RecordedUpdate[],
    insert: [] as (OnboardingProfileFields & { id: string })[],
  };

  const client: ProfileWriteClient = {
    from() {
      return {
        update(values: OnboardingProfileFields) {
          const recorded: RecordedUpdate = { values };
          calls.update.push(recorded);
          return {
            eq(_column: "id", value: string) {
              recorded.id = value;
              return {
                select() {
                  return Promise.resolve({
                    data: updateRows,
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

  it("propagates an INSERT error", async () => {
    const { client } = makeClient([], {
      insert: { code: "23505", message: "duplicate key value" },
    });

    await expect(
      saveOnboardingProfile(client, "new-user", FIELDS)
    ).rejects.toMatchObject({ code: "23505" });
  });
});
