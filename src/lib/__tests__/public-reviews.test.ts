import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchPublicReviews } from "@/lib/reviews/public-reviews";

const { select, eq, order } = vi.hoisted(() => ({
  select: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({ select }),
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  select.mockReturnValue({ eq });
  eq.mockReturnValue({ order });
  order.mockResolvedValue({
    data: [
      { id: "trusted", rating: 5, trust_score: 80, reviewer_name: "A" },
      { id: "untrusted", rating: 1, trust_score: 10, reviewer_name: "B" },
    ],
    error: null,
  });
});

describe("public review read", () => {
  it("selects no private email and strips trust scores from serialized reviews", async () => {
    const result = await fetchPublicReviews("builder-id");

    expect(select.mock.calls[0][0]).not.toContain("reviewer_email");
    expect(eq).toHaveBeenCalledWith("builder_id", "builder-id");
    expect(result).toEqual({
      reviews: [
        { id: "trusted", rating: 5, reviewer_name: "A" },
        { id: "untrusted", rating: 1, reviewer_name: "B" },
      ],
      average_rating: 5,
      total_reviews: 2,
      trusted_reviews: 1,
    });
  });
});
