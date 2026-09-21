import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";

const getUser = vi.hoisted(() => vi.fn());
const createAdminClient = vi.hoisted(() => vi.fn());

vi.mock("@/lib/rate-limit", () => ({
  reportLimiter: null,
  getIP: () => "127.0.0.1",
  checkRateLimit: async () => ({ success: true }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({ auth: { getUser } }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));

function reportRequest() {
  return new NextRequest("https://www.vibetalent.work/api/report", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      project_id: "4d39708b-64f8-4728-9230-3e11b4e17771",
      reason: "Spam",
    }),
  });
}

function reportDatabase(legacyReportCount = 0) {
  const reports: Array<{ id: string; project_id: string; reporter_user_id?: string }> = Array.from(
    { length: legacyReportCount },
    (_, index) => ({ id: `legacy-${index}`, project_id: "4d39708b-64f8-4728-9230-3e11b4e17771" }),
  );
  let flagged = false;
  const client = {
    from(table: string) {
      if (table === "project_reports") {
        return {
          insert(row: { project_id: string; reporter_user_id?: string }) {
            return {
              select() {
                return {
                  async single() {
                    if (reports.some((report) => report.project_id === row.project_id && report.reporter_user_id === row.reporter_user_id)) {
                      return { data: null, error: { code: "23505", message: "duplicate key" } };
                    }
                    const inserted = { ...row, id: `report-${reports.length + 1}` };
                    reports.push(inserted);
                    return { data: inserted, error: null };
                  },
                };
              },
            };
          },
          select() {
            let identifiedOnly = false;
            return {
              not(field: string, operator: string, value: unknown) {
                if (field === "reporter_user_id" && operator === "is" && value === null) identifiedOnly = true;
                return this;
              },
              async eq(_column: string, projectId: string) {
                return {
                  count: reports.filter((report) => report.project_id === projectId && (!identifiedOnly || report.reporter_user_id)).length,
                  error: null,
                };
              },
            };
          },
        };
      }
      if (table === "projects") {
        return {
          update(value: { flagged: boolean }) {
            return {
              async eq() {
                flagged = value.flagged;
                return { error: null };
              },
            };
          },
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  };
  return { client, reports, isFlagged: () => flagged };
}

describe("POST /api/report", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects an anonymous report before using the admin client", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });

    const response = await POST(reportRequest());

    expect(response.status).toBe(401);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("records the signed-in reporter so one account has one report per project", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "reporter-1" } }, error: null });
    const database = reportDatabase();
    createAdminClient.mockReturnValue(database.client);

    const first = await POST(reportRequest());
    const second = await POST(reportRequest());

    expect(first.status).toBe(200);
    expect(second.status).toBe(409);
    expect(database.reports).toHaveLength(1);
    expect(database.reports[0].reporter_user_id).toBe("reporter-1");
    expect(database.isFlagged()).toBe(false);
  });

  it("auto-flags only after three distinct accounts report the project", async () => {
    const database = reportDatabase();
    createAdminClient.mockReturnValue(database.client);

    for (const id of ["reporter-1", "reporter-2", "reporter-3"]) {
      getUser.mockResolvedValue({ data: { user: { id } }, error: null });
      const response = await POST(reportRequest());
      expect(response.status).toBe(200);
    }

    expect(database.reports).toHaveLength(3);
    expect(database.isFlagged()).toBe(true);
  });

  it("does not count legacy reports with no verified reporter toward auto-flagging", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "reporter-1" } }, error: null });
    const database = reportDatabase(2);
    createAdminClient.mockReturnValue(database.client);

    const response = await POST(reportRequest());

    expect(response.status).toBe(200);
    expect(database.isFlagged()).toBe(false);
  });
});
