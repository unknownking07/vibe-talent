import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ReviewsSection from "@/components/profile/reviews-section";

describe("profile reviews", () => {
  it("renders server-provided reviews in the first HTML response", () => {
    const renderedAt = Date.parse("2026-09-27T12:10:00.000Z");
    const html = renderToString(
      <ReviewsSection
        builderId="builder-id"
        renderedAt={renderedAt}
        initialReviews={[{
          id: "review-id",
          builder_id: "builder-id",
          reviewer_name: "Casey",
          rating: 5,
          comment: "Shipped on time",
          created_at: "2026-09-27T12:00:00.000Z",
          reviewer_user_id: null,
        }]}
      />,
    );

    expect(html).toContain("Shipped on time");
    expect(html).toContain("Casey");
    expect(html).toContain("10m ago");
    expect(html).not.toContain("animate-pulse");
  });
});
