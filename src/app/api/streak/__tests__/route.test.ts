import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../route";

const createAdminClient = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));

const userId = "4d39708b-64f8-4728-9230-3e11b4e17771";
const request = (id = userId) =>
  new NextRequest(`https://www.vibetalent.work/api/streak?user_id=${id}`);

describe("GET /api/streak", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns persisted streak and score values", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { streak: 3, longest_streak: 8, badge_level: "none", vibe_score: 42 },
      error: null,
    });
    createAdminClient.mockReturnValue({
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
    });

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      user_id: userId,
      current_streak: 3,
      longest_streak: 8,
      badge_level: "none",
      vibe_score: 42,
    });
    expect(maybeSingle).toHaveBeenCalledOnce();
  });

  it("rejects malformed IDs before querying the database", async () => {
    const response = await GET(request("not-a-uuid"));
    expect(response.status).toBe(400);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("returns 404 for a missing builder", async () => {
    createAdminClient.mockReturnValue({
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
    });

    const response = await GET(request());
    expect(response.status).toBe(404);
  });
});
