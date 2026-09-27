import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ReviewsSection from "@/components/profile/reviews-section";

describe("profile reviews", () => {
  it("renders server-provided reviews in the first HTML response", () => {
    const html = renderToString(
      <ReviewsSection
        builderId="builder-id"
        initialReviews={[{
          id: "review-id",
          builder_id: "builder-id",
          reviewer_name: "Casey",
          rating: 5,
          comment: "Shipped on time",
          created_at: new Date().toISOString(),
          reviewer_user_id: null,
        }]}
      />,
    );

    expect(html).toContain("Shipped on time");
    expect(html).toContain("Casey");
    expect(html).not.toContain("animate-pulse");
  });
});
