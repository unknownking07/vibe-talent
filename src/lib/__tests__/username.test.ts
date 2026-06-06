import { describe, it, expect } from "vitest";
import {
  validateUsername,
  isUsernameTakenError,
  checkUsernameAvailable,
  type UsernameLookupClient,
} from "../username";

describe("validateUsername", () => {
  it("accepts valid lowercase handles", () => {
    expect(validateUsername("rishad")).toBeNull();
    expect(validateUsername("vibe_coder_99")).toBeNull();
  });

  it("rejects too-short handles", () => {
    expect(validateUsername("ab")).toMatch(/at least 3/i);
  });

  it("rejects uppercase, spaces, and symbols", () => {
    expect(validateUsername("Rishad")).toMatch(/lowercase/i);
    expect(validateUsername("ris had")).toMatch(/lowercase/i);
    expect(validateUsername("ris-had")).toMatch(/lowercase/i);
  });
});

describe("isUsernameTakenError", () => {
  it("is true for 23505 on the username constraint", () => {
    expect(
      isUsernameTakenError({
        code: "23505",
        message: 'duplicate key value violates unique constraint "users_username_key"',
      })
    ).toBe(true);
  });

  it("is false for 23505 on the github_id index (not a username clash)", () => {
    expect(
      isUsernameTakenError({
        code: "23505",
        message: 'duplicate key value violates unique constraint "idx_users_github_id_unique"',
      })
    ).toBe(false);
  });

  it("is false for non-unique errors and non-error values", () => {
    expect(isUsernameTakenError({ code: "42501", message: "permission denied" })).toBe(false);
    expect(isUsernameTakenError({ code: "23502", message: "null value" })).toBe(false);
    expect(isUsernameTakenError(null)).toBe(false);
    expect(isUsernameTakenError("23505")).toBe(false);
    expect(isUsernameTakenError(undefined)).toBe(false);
  });
});

function lookupClient(row: { id: string } | null, error: unknown = null): UsernameLookupClient {
  return {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle() {
                  return Promise.resolve({ data: row, error });
                },
              };
            },
          };
        },
      };
    },
  };
}

describe("checkUsernameAvailable", () => {
  it("is available when no row exists", async () => {
    const res = await checkUsernameAvailable(lookupClient(null), "freename");
    expect(res).toEqual({ available: true, error: null });
  });

  it("is taken when a row owned by someone else exists", async () => {
    const res = await checkUsernameAvailable(lookupClient({ id: "other-user" }), "taken", "me");
    expect(res.available).toBe(false);
  });

  it("is available when the existing row is the caller's own (settings, unchanged handle)", async () => {
    const res = await checkUsernameAvailable(lookupClient({ id: "me" }), "myname", "me");
    expect(res.available).toBe(true);
  });

  it("treats an existing row as taken when no currentUserId is given (onboarding)", async () => {
    const res = await checkUsernameAvailable(lookupClient({ id: "anyone" }), "taken");
    expect(res.available).toBe(false);
  });

  it("surfaces a lookup error as not-available without throwing", async () => {
    const res = await checkUsernameAvailable(lookupClient(null, { code: "500" }), "x");
    expect(res.available).toBe(false);
    expect(res.error).toMatchObject({ code: "500" });
  });
});
