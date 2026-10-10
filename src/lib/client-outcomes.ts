/**
 * Public interaction metrics. Replies and reviews do not prove paid delivery.
 * Legacy delivery fields remain present as null (unknown) for API consumers.
 */

import type { ClientOutcomes } from "@/lib/types/database";

interface HireRequestRow {
  id: string;
  sender_email: string;
  status: string;
  created_at: string;
  replied_at: string | null;
}

interface ReviewRow {
  rating: number;
  trust_score: number;
}

export function computeClientOutcomes(
  hireRequests: HireRequestRow[],
  reviews: ReviewRow[]
): ClientOutcomes {
  const totalRequests = hireRequests.length;

  // A reply establishes a conversation only.
  const repliedRequests = hireRequests.filter((h) => h.status === "replied").length;

  // Response rate
  const responseRate = totalRequests > 0 ? Math.round((repliedRequests / totalRequests) * 100) : 0;

  // Reviews passing the existing abuse heuristic; delivery is still unverified.
  const trustedReviews = reviews.filter((r) => r.trust_score >= 30);
  const totalReviews = trustedReviews.length;
  const avgRating =
    totalReviews > 0
      ? Math.round(
          (trustedReviews.reduce((sum, r) => {
            // Weight by trust_score: a 100-trust review counts fully, a 30-trust review counts 30%
            const weight = r.trust_score / 100;
            return sum + r.rating * weight;
          }, 0) /
            trustedReviews.reduce((sum, r) => sum + r.trust_score / 100, 0)) *
            10
        ) / 10
      : 0;

  // Returning contacts: repeated requests do not establish repeat paid work.
  // Normalize emails to prevent case/whitespace variants being treated as different clients
  const emailCounts = new Map<string, number>();
  for (const h of hireRequests) {
    const normalizedEmail = h.sender_email.trim().toLowerCase();
    if (!normalizedEmail) continue;
    emailCounts.set(normalizedEmail, (emailCounts.get(normalizedEmail) || 0) + 1);
  }
  const returningContacts = Array.from(emailCounts.values()).filter((c) => c > 1).length;

  // Average response time (hours from created_at to replied_at)
  const responseTimes: number[] = [];
  for (const h of hireRequests) {
    if (h.replied_at) {
      const created = new Date(h.created_at).getTime();
      const replied = new Date(h.replied_at).getTime();
      const hours = (replied - created) / (1000 * 60 * 60);
      if (hours >= 0 && hours < 720) {
        // Cap at 30 days, ignore obviously wrong data
        responseTimes.push(hours);
      }
    }
  }
  const avgResponseHours =
    responseTimes.length > 0
      ? Math.round((responseTimes.reduce((s, h) => s + h, 0) / responseTimes.length) * 10) / 10
      : null;

  return {
    total_requests: totalRequests,
    replied_requests: repliedRequests,
    response_rate: responseRate,
    returning_contacts: returningContacts,
    avg_rating: avgRating,
    total_reviews: totalReviews,
    avg_response_hours: avgResponseHours,
    total_hires: null,
    completed_hires: null,
    repeat_clients: null,
    completion_rate: null,
    outcome_score: null,
  };
}
