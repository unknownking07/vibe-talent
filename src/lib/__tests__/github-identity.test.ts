import { describe, it, expect, vi, afterEach } from "vitest";
import type { User } from "@supabase/supabase-js";

import {
  readGithubIdentity,
  syncGithubMirrors,
  type MirrorClient,
} from "@/lib/github-identity";

type Call = { table: string; op: "update" | "upsert"; payload: unknown };

/**
 * Stands in for PostgREST's builder, which is *lazy*: the request is issued
 * inside `then()`, so a query nobody awaits never leaves the browser. Recording
 * on `then` rather than on the method call is the whole point — it is what
 * makes these tests fail if the `await` is ever dropped again.
 */
function lazyResult(record: () => void, error: { message: string } | null) {
  return {
    then(
      onFulfilled: (v: { error: typeof error }) => unknown,
      onRejected?: (e: unknown) => unknown,
    ) {
      record();
      return Promise.resolve({ error }).then(onFulfilled, onRejected);
    },
  };
}

function fakeClient(error: { message: string } | null = null) {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      return {
        update(payload: unknown) {
          return {
            eq: () =>
              lazyResult(
                () => calls.push({ table, op: "update", payload }),
                error,
              ),
          };
        },
        upsert(payload: unknown) {
          return lazyResult(
            () => calls.push({ table, op: "upsert", payload }),
            error,
          );
        },
      };
    },
  };
  return { client: client as unknown as MirrorClient, calls };
}

/** A UserIdentity with the bookkeeping fields Supabase always sends. */
function identity(provider: string, data: Record<string, unknown>) {
  return {
    id: `${provider}-id`,
    user_id: "u1",
    identity_id: `${provider}-identity`,
    provider,
    identity_data: data,
  };
}

function user(
  over: { identities?: unknown; user_metadata?: Record<string, unknown> } = {},
): User {
  return {
    id: "u1",
    identities: [identity("github", { user_name: "octocat", sub: "583231" })],
    user_metadata: {},
    ...over,
  } as unknown as User;
}

afterEach(() => vi.restoreAllMocks());

describe("readGithubIdentity", () => {
  it("reads the handle and numeric id from the identity", () => {
    expect(readGithubIdentity(user())).toEqual({
      username: "octocat",
      id: 583231,
    });
  });

  // The bug this guards: user_metadata outlives unlinkIdentity, so a builder
  // who disconnected GitHub had the handle written straight back.
  it("returns null once the GitHub identity is gone, whatever metadata says", () => {
    const unlinked = user({
      identities: [identity("google", {})],
      user_metadata: { user_name: "octocat", preferred_username: "octocat" },
    });
    expect(readGithubIdentity(unlinked)).toBeNull();
  });

  it("falls back through preferred_username then metadata", () => {
    const viaPreferred = user({
      identities: [identity("github", { preferred_username: "hubot" })],
    });
    expect(readGithubIdentity(viaPreferred)?.username).toBe("hubot");

    const viaMetadata = user({
      identities: [identity("github", {})],
      user_metadata: { user_name: "hubot" },
    });
    expect(readGithubIdentity(viaMetadata)?.username).toBe("hubot");
  });

  it("treats a non-numeric or missing subject id as no id", () => {
    const noId = user({
      identities: [identity("github", { user_name: "octocat" })],
    });
    expect(readGithubIdentity(noId)).toEqual({ username: "octocat", id: null });

    const badId = user({
      identities: [
        identity("github", { user_name: "octocat", sub: "not-a-number" }),
      ],
    });
    expect(readGithubIdentity(badId)?.id).toBeNull();
  });

  it("ignores a blank handle rather than mirroring an empty string", () => {
    const blank = user({
      identities: [identity("github", { user_name: "   " })],
      user_metadata: {},
    });
    expect(readGithubIdentity(blank)).toBeNull();
  });

  it("survives a user with no identities at all", () => {
    expect(readGithubIdentity(null)).toBeNull();
    expect(readGithubIdentity(user({ identities: undefined }))).toBeNull();
  });
});

describe("syncGithubMirrors", () => {
  // The original bug: both writes were issued without `await`, so neither ever
  // reached the database while the page showed the handle as repaired.
  it("actually issues the writes when both mirrors are empty", async () => {
    const { client, calls } = fakeClient();
    const identity = await syncGithubMirrors(client, "u1", user(), {
      githubUsername: null,
      githubId: null,
      socialGithub: null,
    });

    expect(identity).toEqual({ username: "octocat", id: 583231 });
    expect(calls).toEqual([
      {
        table: "users",
        op: "update",
        payload: { github_username: "octocat", github_id: 583231 },
      },
      {
        table: "social_links",
        op: "upsert",
        payload: { user_id: "u1", github: "octocat" },
      },
    ]);
  });

  it("writes nothing when no GitHub identity is attached", async () => {
    const { client, calls } = fakeClient();
    const unlinked = user({
      identities: [identity("google", {})],
      user_metadata: { user_name: "octocat" },
    });

    expect(
      await syncGithubMirrors(client, "u1", unlinked, {
        githubUsername: null,
        socialGithub: null,
      }),
    ).toBeNull();
    expect(calls).toEqual([]);
  });

  it("fills only the gaps, leaving a mirror that is already set alone", async () => {
    const { client, calls } = fakeClient();
    await syncGithubMirrors(client, "u1", user(), {
      githubUsername: "octocat",
      githubId: 583231,
      socialGithub: "octocat",
    });
    expect(calls).toEqual([]);
  });

  // github-sync's rename-versus-reclaim guard depends on the stored id, and the
  // unique partial index would reject a conflicting one.
  it("never overwrites a github_id that is already canonicalised", async () => {
    const { client, calls } = fakeClient();
    await syncGithubMirrors(client, "u1", user(), {
      githubUsername: null,
      githubId: 111,
      socialGithub: "octocat",
    });
    expect(calls).toEqual([
      {
        table: "users",
        op: "update",
        payload: { github_username: "octocat" },
      },
    ]);
  });

  it("backfills only social_links when users is already correct", async () => {
    const { client, calls } = fakeClient();
    await syncGithubMirrors(client, "u1", user(), {
      githubUsername: "octocat",
      githubId: 583231,
      socialGithub: null,
    });
    expect(calls).toEqual([
      {
        table: "social_links",
        op: "upsert",
        payload: { user_id: "u1", github: "octocat" },
      },
    ]);
  });

  it("reports a failed write instead of swallowing it", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = fakeClient({ message: "permission denied" });

    const identity = await syncGithubMirrors(client, "u1", user(), {
      githubUsername: null,
      githubId: null,
      socialGithub: null,
    });

    // Still returned, so the page renders with the right handle and retries.
    expect(identity?.username).toBe("octocat");
    expect(logged).toHaveBeenCalledTimes(2);
    expect(logged.mock.calls.map((c) => c[0])).toEqual([
      "github mirror: users update failed",
      "github mirror: social_links upsert failed",
    ]);
  });
});
