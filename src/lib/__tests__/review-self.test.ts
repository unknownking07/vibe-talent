import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/reviews/route";

const builderId = "11111111-1111-4111-8111-111111111111";
const adminClient = vi.hoisted(() => vi.fn());

vi.mock("@/lib/rate-limit", () => ({
  reviewLimiter: {},
  getIP: () => "127.0.0.1",
  checkRateLimit: async () => ({ success: true }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: builderId } } }) },
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: adminClient }));

describe("review submission", () => {
  it("rejects an authenticated self-review before writing to the database", async () => {
    const request = new NextRequest("https://www.vibetalent.work/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        builder_id: builderId,
        reviewer_name: "Builder",
        reviewer_email: "builder@valid.dev",
        rating: 5,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "You cannot review your own profile." });
    expect(adminClient).not.toHaveBeenCalled();
  });
});
