import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";

const createAdminClient = vi.hoisted(() => vi.fn());
const checkRateLimit = vi.hoisted(() => vi.fn());
const after = vi.hoisted(() => vi.fn());
const sendFounderBriefNotification = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("@/lib/rate-limit", () => ({
  founderBriefLimiter: null,
  getIP: () => "127.0.0.1",
  checkRateLimit,
}));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after,
}));
vi.mock("@/lib/email", () => ({ sendFounderBriefNotification }));

const valid = {
  name: "Ada Lovelace",
  email: "ada@startup.io",
  description: "We need a working MVP for our customer onboarding workflow.",
  tech_stack: ["React", "Supabase"],
  project_type: "mvp",
  timeline: "1_month",
  budget: "2k_5k",
  consent: true,
};

function request(body: unknown = valid) {
  return new NextRequest("https://www.vibetalent.work/api/founder-briefs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function database(recentCount = 0, insertError = false) {
  const inserts: unknown[] = [];
  const client = {
    from(table: string) {
      expect(table).toBe("founder_briefs");
      return {
        select() {
          return {
            eq() {
              return {
                gte() {
                  return {
                    async limit() {
                      return { data: Array.from({ length: recentCount }, (_, i) => ({ id: String(i) })), error: null };
                    },
                  };
                },
              };
            },
          };
        },
        insert(row: unknown) {
          inserts.push(row);
          return {
            select() {
              return {
                async single() {
                  return insertError
                    ? { data: null, error: { message: "database unavailable" } }
                    : { data: { id: "brief-1" }, error: null };
                },
              };
            },
          };
        },
      };
    },
  };
  return { client, inserts };
}

describe("POST /api/founder-briefs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkRateLimit.mockResolvedValue({ success: true });
  });

  it("rejects unconsented or invalid briefs before touching the database", async () => {
    const response = await POST(request({ ...valid, consent: false }));
    expect(response.status).toBe(400);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("limits requests by IP before parsing or accessing the database", async () => {
    checkRateLimit.mockResolvedValue({ success: false });
    const response = await POST(request());
    expect(response.status).toBe(429);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("limits repeat submissions from one email", async () => {
    const db = database(3);
    createAdminClient.mockReturnValue(db.client);
    const response = await POST(request());
    expect(response.status).toBe(429);
    expect(db.inserts).toHaveLength(0);
  });

  it("saves the brief and schedules an operator notification", async () => {
    const db = database();
    createAdminClient.mockReturnValue(db.client);
    const response = await POST(request());
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: "brief-1" });
    expect(db.inserts).toHaveLength(1);
    expect(db.inserts[0]).toMatchObject({ email: "ada@startup.io", status: "new" });
    expect(after).toHaveBeenCalledOnce();
    sendFounderBriefNotification.mockRejectedValue(new Error("email down"));
    await expect(after.mock.calls[0][0]()).resolves.toBeUndefined();
  });

  it("returns a server error when the brief could not be saved", async () => {
    const db = database(0, true);
    createAdminClient.mockReturnValue(db.client);
    const response = await POST(request());
    expect(response.status).toBe(500);
    expect(after).not.toHaveBeenCalled();
  });
});
