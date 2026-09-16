import { describe, it, expect } from "vitest";

import {
  creditReferral,
  REFERRAL_WINDOW_DAYS,
  type ReferralClient,
} from "@/lib/referrals";

type Write = {
  table: string;
  op: "insert" | "update" | "upsert";
  payload: unknown;
  options?: unknown;
};

const NOW = new Date("2026-09-16T12:00:00Z");
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
            lookups.push(value);
            return {
              maybeSingle: () =>
                lazy({ data: referrerId ? { id: referrerId } : null }),
            };
          },
        }),
        insert: (payload: unknown) =>
          lazy({ error: insertError }, () =>
            writes.push({ table, op: "insert", payload }),
          ),
        update: (payload: unknown) => ({
          eq: () =>
            lazy({}, () => writes.push({ table, op: "update", payload })),
        }),
        upsert: (payload: unknown, options: unknown) =>
          lazy({}, () => writes.push({ table, op: "upsert", payload, options })),
      };
    },
  };

  return { client: client as unknown as ReferralClient, writes, lookups };
}

const newUser = { id: "new-user", created_at: "2026-09-16T11:00:00Z" };

describe("creditReferral", () => {
  it("records the referral, recounts the referrer, and gives them a streak day", async () => {
    const { client, writes } = fakeClient();

    await expect(creditReferral(client, newUser, "octocat", NOW)).resolves.toEqual({
      credited: true,
    });
    expect(writes).toEqual([
      {
        table: "referrals",
        op: "insert",
        payload: { referrer_id: "referrer-1", referred_id: "new-user" },
      },
      { table: "users", op: "update", payload: { referral_count: 3 } },
      {
        table: "streak_logs",
        op: "upsert",
        payload: { user_id: "referrer-1", activity_date: "2026-09-16" },
        options: { onConflict: "user_id,activity_date", ignoreDuplicates: true },
      },
    ]);
  });

  it("looks the referrer up by normalized username", async () => {
    const { client, lookups } = fakeClient();
    await creditReferral(client, newUser, "  OctoCat ", NOW);
    expect(lookups).toEqual(["octocat"]);
  });

  it("refuses a self-referral without writing anything", async () => {
    const { client, writes } = fakeClient({ referrerId: "new-user" });
    await expect(creditReferral(client, newUser, "me", NOW)).resolves.toEqual({
      credited: false,
      reason: "self_referral",
    });
    expect(writes).toEqual([]);
  });

  it("refuses an unknown referrer", async () => {
    const { client, writes } = fakeClient({ referrerId: null });
    await expect(creditReferral(client, newUser, "ghost", NOW)).resolves.toEqual({
      credited: false,
      reason: "unknown_referrer",
    });
    expect(writes).toEqual([]);
  });

  it("refuses accounts older than the referral window, and unparseable dates", async () => {
    const tooOld = new Date(NOW.getTime() - (REFERRAL_WINDOW_DAYS + 1) * DAY_MS);
    for (const created_at of [tooOld.toISOString(), "not-a-date"]) {
      const { client, writes } = fakeClient();
      await expect(
        creditReferral(client, { id: "old-user", created_at }, "octocat", NOW),
      ).resolves.toEqual({ credited: false, reason: "not_a_new_signup" });
      expect(writes).toEqual([]);
    }
  });

  it("credits nothing more for an account that was already referred", async () => {
    const { client, writes } = fakeClient({ insertError: { code: "23505" } });
    await expect(creditReferral(client, newUser, "octocat", NOW)).resolves.toEqual({
      credited: false,
      reason: "already_referred",
    });
    expect(writes.map((w) => w.op)).toEqual(["insert"]);
  });

  it("throws on any other database error instead of swallowing it", async () => {
    const { client } = fakeClient({ insertError: { code: "42501" } });
    await expect(creditReferral(client, newUser, "octocat", NOW)).rejects.toEqual({
      code: "42501",
    });
  });
});
