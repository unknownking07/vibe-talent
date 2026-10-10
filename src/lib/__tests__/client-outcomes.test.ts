import { describe, expect, it } from "vitest";
import { computeClientOutcomes } from "../client-outcomes";

const request = {
  id: "request-1", sender_email: "client@example.com", status: "replied",
  created_at: "2026-10-01T10:00:00Z", replied_at: "2026-10-01T12:00:00Z",
};

describe("client interaction metrics", () => {
  it("does not treat a reply or repeated emails as completed paid work", () => {
    const result = computeClientOutcomes([request, { ...request, id: "request-2", sender_email: " CLIENT@example.com " }], [{ rating: 5, trust_score: 100 }]);
    expect(result).toMatchObject({ total_requests: 2, replied_requests: 2, response_rate: 100, returning_contacts: 1, avg_response_hours: 2 });
    expect(result.total_hires).toBeNull();
    expect(result.completed_hires).toBeNull();
    expect(result.completion_rate).toBeNull();
    expect(result.repeat_clients).toBeNull();
    expect(result.outcome_score).toBeNull();
  });

  it("returns unknown delivery outcomes even with no requests", () => {
    const result = computeClientOutcomes([], []);
    expect(result.total_hires).toBeNull();
    expect(result.completed_hires).toBeNull();
    expect(result.response_rate).toBe(0);
    expect(result.avg_response_hours).toBeNull();
  });

  it("counts responses and review heuristics without leaking contact details", () => {
    const result = computeClientOutcomes([request, { ...request, status: "pending", replied_at: null }], [{ rating: 5, trust_score: 100 }, { rating: 1, trust_score: 20 }]);
    expect(result).toMatchObject({ replied_requests: 1, response_rate: 50, total_reviews: 1, avg_rating: 5 });
    expect(JSON.stringify(result)).not.toContain("client@example.com");
  });
});
