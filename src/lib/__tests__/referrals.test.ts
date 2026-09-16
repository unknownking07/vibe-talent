import { describe, it, expect } from "vitest";

import {
  creditReferral,
  REFERRAL_WINDOW_DAYS,
  type ReferralClient,
} from "@/lib/referrals";

type ReferredUser = Parameters<typeof creditReferral>[1];

type Write = {
  table: string;
  op: "insert" | "update" | "upsert";
  payload: unknown;
  filters?: Record<string, unknown>;
  options?: unknown;
};

const NOW = new Date("2026-09-16T12:00:00Z");
const INSERTED_AT = "2026-09-16T11:59:00.123456+00:00";
const DAY_MS = 86_400_000;

/**
 * PostgREST builders are lazy: nothing is sent until `then()`. Recording writes
 * there, not when the method is called, keeps a dropped `await` from passing.
 */
function lazy(value: object, record?: () => void) {
  return {
    then(
      onFulfilled: (v: object) => unknown,
      onRejected?: (e: unknown) => unknown,
    ) {
      record?.();
      return Promise.resolve({ error: null, ...value }).then(
        onFulfilled,
        onRejected,
      );
    },
  };
}

function fakeClient({
  referrerId = "referrer-1" as string | null,
  insertError = null as { code: string } | null,
  existingReferral = null as { referrer_id: string; created_at: string } | null,
  referralCount = 3,
} = {}) {
  const writes: Write[] = [];
  const lookups: unknown[] = [];

  const client = {
    from(table: string) {
      return {
        select: (_columns: string, options?: { head?: boolean }) => ({
          eq: (_column: string, value: unknown) => {
            if (options?.head) return lazy({ count: referralCount });
            if (table === "users") {
              lookups.push(value);
              return {
                maybeSingle: () =>
                  lazy({ data: referrerId ? { id: referrerId } : null }),
              };
            }
            return { single: () => lazy({ data: existingReferral }) };
          },
        }),
        insert: (payload: unknown) => ({
          select: () => ({
            single: () =>
              lazy(
                insertError
                  ? { data: null, error: insertError }
                  : { data: { referrer_id: referrerId, created_at: INSERTED_AT } },
                () => writes.push({ table, op: "insert", payload }),
              ),
          }),
        }),
        update: (payload: unknown) => ({
          eq: (column: string, value: unknown) => ({
            lt: (guard: string, bound: unknown) =>
              lazy({}, () =>
                writes.push({
                  table,
                  op: "update",
                  payload,
                  filters: { [column]: value, [`${guard} <`]: bound },
                }),
              ),
          }),
        }),
        upsert: (payload: unknown, options: unknown) =>
          lazy({}, () => writes.push({ table, op: "upsert", payload, options })),
      };
    },
  };

  return { client: client as unknown as ReferralClient, writes, lookups };
}

function referredUser(overrides: Partial<Record<keyof ReferredUser, unknown>> = {}) {
  return {
    id: "new-user",
    created_at: "2026-09-16T11:00:00Z",
    identities: [
      {
        id: "github-id",
        user_id: "new-user",
        identity_id: "github-identity",
        provider: "github",
        identity_data: { user_name: "newbie", sub: "583231" },
      },
    ],
    user_metadata: {},
    ...overrides,
  } as unknown as ReferredUser;
}

describe("creditReferral", () => {
  it("records the referral, updates the referrer's count, and gives them a streak day", async () => {
    const { client, writes } = fakeClient();

    await expect(
      creditReferral(client, referredUser(), "octocat", NOW),
    ).resolves.toEqual({ credited: true });
    expect(writes).toEqual([
      {
        table: "referrals",
        op: "insert",
        payload: { referrer_id: "referrer-1", referred_id: "new-user" },
      },
      {
        table: "users",
        op: "update",
        payload: { referral_count: 3 },
        filters: { id: "referrer-1", "referral_count <": 3 },
      },
      {
        table: "streak_logs",
        op: "upsert",
        payload: { user_id: "referrer-1", activity_date: "2026-09-16" },
        options: { onConflict: "user_id,activity_date", ignoreDuplicates: true },
      },
    ]);
  });

  it("only ever raises referral_count, so a stale concurrent count cannot lower it", async () => {
    const { client, writes } = fakeClient({ referralCount: 7 });
    await creditReferral(client, referredUser(), "octocat", NOW);

    const update = writes.find((w) => w.op === "update");
    expect(update?.filters).toEqual({ id: "referrer-1", "referral_count <": 7 });
  });

  it("finishes an interrupted credit on retry, dated to the original referral", async () => {
    const { client, writes } = fakeClient({
      insertError: { code: "23505" },
      existingReferral: {
        referrer_id: "referrer-1",
        created_at: "2026-09-10T08:00:00+00:00",
      },
    });

    await expect(
      creditReferral(client, referredUser(), "octocat", NOW),
    ).resolves.toEqual({ credited: true });
    // The retry day (NOW) must not become a second streak day.
    expect(writes.find((w) => w.op === "upsert")?.payload).toEqual({
      user_id: "referrer-1",
      activity_date: "2026-09-10",
    });
  });

  it("refuses an account another builder already referred", async () => {
    const { client, writes } = fakeClient({
      insertError: { code: "23505" },
      existingReferral: {
        referrer_id: "someone-else",
        created_at: "2026-09-10T08:00:00+00:00",
      },
    });

    await expect(
      creditReferral(client, referredUser(), "octocat", NOW),
    ).resolves.toEqual({ credited: false, reason: "already_referred" });
    expect(writes.map((w) => w.op)).toEqual(["insert"]);
  });

  it("looks the referrer up by normalized username", async () => {
    const { client, lookups } = fakeClient();
    await creditReferral(client, referredUser(), "  OctoCat ", NOW);
    expect(lookups).toEqual(["octocat"]);
  });

  it.each([
    [
      "an account without a verified GitHub identity",
      { identities: [] },
      {},
      "github_not_verified",
    ],
    [
      "an account older than the referral window",
      {
        created_at: new Date(
          NOW.getTime() - (REFERRAL_WINDOW_DAYS + 1) * DAY_MS,
        ).toISOString(),
      },
      {},
      "not_a_new_signup",
    ],
    [
      "an unparseable signup date",
      { created_at: "not-a-date" },
      {},
      "not_a_new_signup",
    ],
    ["an unknown referrer", {}, { referrerId: null }, "unknown_referrer"],
    ["a self-referral", {}, { referrerId: "new-user" }, "self_referral"],
  ] as const)(
    "refuses %s without writing anything",
    async (_label, userOverrides, clientOptions, reason) => {
      const { client, writes } = fakeClient(clientOptions);
      await expect(
        creditReferral(client, referredUser(userOverrides), "octocat", NOW),
      ).resolves.toEqual({ credited: false, reason });
      expect(writes).toEqual([]);
    },
  );

  it("throws on any other database error instead of swallowing it", async () => {
    const { client } = fakeClient({ insertError: { code: "42501" } });
    await expect(
      creditReferral(client, referredUser(), "octocat", NOW),
    ).rejects.toEqual({ code: "42501" });
  });
});
