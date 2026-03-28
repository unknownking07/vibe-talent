/**
 * Client Outcomes Scoring
 *
 * Computes a builder's outcome score based on real hire interactions:
 *   - Completed hires (replied hire requests)
 *   - Client ratings (weighted by trust_score)
 *   - Repeat clients (same email hiring again)
 *   - Response time (how fast builder replies)
 *   - Completion rate (replied / total)
 *
 * This is the hardest signal to fake because it requires real people
 * sending hire requests, having conversations, and leaving reviews.
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
  const totalHires = hireRequests.length;

  // Completed = builder replied
  const completedHires = hireRequests.filter((h) => h.status === "replied").length;

  // Completion rate
  const completionRate = totalHires > 0 ? Math.round((completedHires / totalHires) * 100) : 0;

  // Trusted reviews only (trust_score >= 30)
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

  // Repeat clients: count emails that sent more than 1 hire request
  const emailCounts = new Map<string, number>();
  for (const h of hireRequests) {
    emailCounts.set(h.sender_email, (emailCounts.get(h.sender_email) || 0) + 1);
  }
  const repeatClients = Array.from(emailCounts.values()).filter((c) => c > 1).length;

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

  // --- OUTCOME SCORE (0-100) ---
  // Weighted composite of all client outcome signals
  let outcomeScore = 0;

  // Completed hires (0-30 pts): having real hire conversations
  outcomeScore += Math.min(30, completedHires * 6);

  // Avg rating from trusted reviews (0-25 pts)
  if (totalReviews > 0) {
    outcomeScore += Math.round((avgRating / 5) * 25);
  }

  // Review volume (0-15 pts): more trusted reviews = more signal
  outcomeScore += Math.min(15, totalReviews * 3);

  // Repeat clients (0-15 pts): the ultimate trust signal
  outcomeScore += Math.min(15, repeatClients * 5);

  // Response speed (0-15 pts): fast responders are more reliable
  if (avgResponseHours !== null) {
    if (avgResponseHours <= 2) outcomeScore += 15;
    else if (avgResponseHours <= 8) outcomeScore += 12;
    else if (avgResponseHours <= 24) outcomeScore += 8;
    else if (avgResponseHours <= 72) outcomeScore += 4;
  }

  outcomeScore = Math.min(100, outcomeScore);

  return {
    total_hires: totalHires,
    completed_hires: completedHires,
    avg_rating: avgRating,
    total_reviews: totalReviews,
    repeat_clients: repeatClients,
    avg_response_hours: avgResponseHours,
    completion_rate: completionRate,
    outcome_score: outcomeScore,
  };
}
