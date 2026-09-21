import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";

const getUser = vi.hoisted(() => vi.fn());
const rpc = vi.hoisted(() => vi.fn());
const createAdminClient = vi.hoisted(() => vi.fn());

vi.mock("@/lib/rate-limit", () => ({
  messagesLimiter: null,
  getIP: () => "127.0.0.1",
  checkRateLimit: async () => ({ success: true }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({ auth: { getUser } }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));

const request = () => new NextRequest("https://www.vibetalent.work/api/streak/recalculate", { method: "POST" });

describe("POST /api/streak/recalculate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createAdminClient.mockReturnValue({ rpc });
    rpc.mockResolvedValue({ error: null });
  });

  it("does not invoke the privileged function for an anonymous caller", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });

    const response = await POST(request());

    expect(response.status).toBe(401);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("recalculates only the authenticated user's score", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "signed-in-user" } }, error: null });

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("update_user_streak", { p_user_id: "signed-in-user" });
  });
});
