import { describe, it, expect } from "vitest";
import {
  validateUsername,
  isUsernameTakenError,
  checkUsernameAvailable,
  normalizeUsernameInput,
  sanitizeUsernameSeed,
  suggestAvailableUsername,
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

describe("normalizeUsernameInput", () => {
  it("turns separators into underscores instead of deleting them", () => {
    // The old filter dropped these outright, so "Abhinav K" silently became
    // "abhinavk" and the field read as broken mid-keystroke.
    expect(normalizeUsernameInput("Abhinav K")).toBe("abhinav_k");
    expect(normalizeUsernameInput("john.doe")).toBe("john_doe");
    expect(normalizeUsernameInput("my-handle")).toBe("my_handle");
  });

  it("collapses a run of separators into one underscore", () => {
    expect(normalizeUsernameInput("a   b")).toBe("a_b");
  });

  it("still strips characters outside the charset", () => {
    expect(normalizeUsernameInput("rishad!!")).toBe("rishad");
    expect(normalizeUsernameInput("café")).toBe("caf");
  });

  it("leaves deliberate underscores alone so typing isn't fought", () => {
    expect(normalizeUsernameInput("a__b")).toBe("a__b");
    expect(normalizeUsernameInput("trailing_")).toBe("trailing_");
  });
});

describe("sanitizeUsernameSeed", () => {
  it("tidies a derived candidate", () => {
    expect(sanitizeUsernameSeed("Abhinav K")).toBe("abhinav_k");
    expect(sanitizeUsernameSeed("a___b")).toBe("a_b");
    expect(sanitizeUsernameSeed("_abhinav_")).toBe("abhinav");
  });

  it("returns empty for anything that can't make a valid handle", () => {
    expect(sanitizeUsernameSeed(null)).toBe("");
    expect(sanitizeUsernameSeed(undefined)).toBe("");
    expect(sanitizeUsernameSeed("")).toBe("");
    expect(sanitizeUsernameSeed("ab")).toBe(""); // under the 3-char minimum
    expect(sanitizeUsernameSeed("अभिनव")).toBe(""); // nothing latin survives
  });

  it("caps length without leaving a trailing underscore", () => {
    const seed = sanitizeUsernameSeed("abcdefghijklmnopqrs_tuvwxyz");
    expect(seed.length).toBeLessThanOrEqual(20);
    expect(seed.endsWith("_")).toBe(false);
    expect(validateUsername(seed)).toBeNull();
  });
});

/** Lookup client where `taken` handles resolve to an existing row. */
function takenClient(taken: string[], error: unknown = null): UsernameLookupClient {
  return {
    from() {
      return {
        select() {
          return {
            eq(column: "username", value: string) {
              return {
                maybeSingle() {
                  return Promise.resolve({
                    data: !error && taken.includes(value) ? { id: "someone-else" } : null,
                    error,
                  });
                },
              };
            },
          };
        },
      };
    },
  };
}

describe("suggestAvailableUsername", () => {
  it("prefers the first seed when it's free", async () => {
    const got = await suggestAvailableUsername(takenClient([]), ["ghhandle", "emailpart"]);
    expect(got).toBe("ghhandle");
  });

  it("falls through to the next seed before suffixing", async () => {
    const got = await suggestAvailableUsername(takenClient(["ghhandle"]), [
      "ghhandle",
      "emailpart",
    ]);
    expect(got).toBe("emailpart");
  });

  it("suffixes the preferred seed once every bare candidate is taken", async () => {
    const got = await suggestAvailableUsername(takenClient(["ghhandle", "emailpart"]), [
      "ghhandle",
      "emailpart",
    ]);
    expect(got).toBe("ghhandle_2");
  });

  it("skips unusable seeds and dedupes equivalent ones", async () => {
    const got = await suggestAvailableUsername(takenClient([]), [
      null,
      "ab",
      "Abhinav K",
      "abhinav k",
    ]);
    expect(got).toBe("abhinav_k");
  });

  it("returns null when no seed yields a valid handle", async () => {
    const got = await suggestAvailableUsername(takenClient([]), [null, "ab", "!!"]);
    expect(got).toBeNull();
  });

  it("offers the preferred candidate when the lookup fails", async () => {
    // A handle that might collide still beats a blank required field — the
    // unique constraint gives a clear, recoverable error on submit.
    const got = await suggestAvailableUsername(takenClient([], { code: "500" }), ["ghhandle"]);
    expect(got).toBe("ghhandle");
  });

  it("gives up after exhausting the suffix budget", async () => {
    const taken = ["gh", "gh_2", "gh_3", "gh_4", "gh_5"];
    const got = await suggestAvailableUsername(takenClient(taken), ["gh"]);
    expect(got).toBeNull();
  });
});
