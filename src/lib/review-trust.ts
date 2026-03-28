/**
 * Review Trust Scoring
 *
 * Detects fake/bot reviews by analyzing multiple signals.
 * Returns a trust_score (0-100) where:
 *   100 = highly trustworthy (linked to completed hire, real email, unique patterns)
 *   0   = almost certainly fake (disposable email, duplicate patterns, speed anomalies)
 *
 * Reviews with trust_score < 30 are flagged and excluded from avg rating.
 */

export interface TrustSignals {
  has_hire_request: boolean;
  hire_status: string | null;
  reviewer_email: string;
  reviewer_name: string;
  comment: string | null;
  builder_id: string;
  // Existing reviews by this email across all builders
  existing_reviews_by_email: number;
  // Reviews for this builder from different emails but same name pattern
  same_name_reviews_for_builder: number;
  // Time since hire request was created (hours) — null if no hire request
  hours_since_hire: number | null;
  // How many reviews this email left in the last 24h
  reviews_last_24h: number;
}

export interface TrustResult {
  trust_score: number;
  flags: string[];
}

const DISPOSABLE_DOMAINS = [
  "mailinator.com", "tempmail.com", "throwaway.email", "guerrillamail.com",
  "sharklasers.com", "grr.la", "guerrillamailblock.com", "yopmail.com",
  "fakeinbox.com", "trashmail.com", "dispostable.com", "maildrop.cc",
  "10minutemail.com", "temp-mail.org", "tempail.com", "guerrillamail.info",
  "grr.la", "mailnesia.com", "maildrop.cc", "discard.email",
];

export function calculateReviewTrust(signals: TrustSignals): TrustResult {
  let score = 50; // Start neutral
  const flags: string[] = [];

  // === POSITIVE SIGNALS ===

  // Linked to a completed hire request (strongest signal)
  if (signals.has_hire_request && signals.hire_status === "replied") {
    score += 30;
  }

  // Has a hire request at all (even if not yet replied)
  if (signals.has_hire_request) {
    score += 10;
  }

  // Comment is substantive (not just "good" or "great")
  if (signals.comment && signals.comment.length > 50) {
    score += 5;
  }

  // Reasonable time gap between hire and review (> 24 hours)
  if (signals.hours_since_hire !== null && signals.hours_since_hire > 24) {
    score += 5;
  }

  // === NEGATIVE SIGNALS ===

  // Disposable email
  const emailDomain = signals.reviewer_email.split("@")[1]?.toLowerCase();
  if (emailDomain && DISPOSABLE_DOMAINS.includes(emailDomain)) {
    score -= 40;
    flags.push("disposable_email");
  }

  // Suspiciously quick review after hire (< 1 hour)
  if (signals.hours_since_hire !== null && signals.hours_since_hire < 1) {
    score -= 15;
    flags.push("too_fast_after_hire");
  }

  // No hire request at all — reviewing without ever contacting
  if (!signals.has_hire_request) {
    score -= 20;
    flags.push("no_hire_request");
  }

  // Same email reviewing many builders (review farming)
  if (signals.existing_reviews_by_email > 5) {
    score -= 25;
    flags.push("high_volume_reviewer");
  } else if (signals.existing_reviews_by_email > 2) {
    score -= 10;
    flags.push("frequent_reviewer");
  }

  // Same name pattern reviewing same builder (sock puppets)
  if (signals.same_name_reviews_for_builder > 1) {
    score -= 30;
    flags.push("duplicate_name_pattern");
  }

  // Burst reviews (many in 24h)
  if (signals.reviews_last_24h > 3) {
    score -= 25;
    flags.push("burst_reviews");
  }

  // Generic one-word comment
  if (signals.comment) {
    const lower = signals.comment.toLowerCase().trim();
    const genericComments = ["good", "great", "nice", "awesome", "excellent", "best", "ok", "fine", "cool"];
    if (genericComments.includes(lower)) {
      score -= 10;
      flags.push("generic_comment");
    }
  }

  // No comment at all
  if (!signals.comment || signals.comment.trim().length === 0) {
    score -= 5;
    flags.push("no_comment");
  }

  // Name looks fake (single character, all same letter, numbers only)
  const nameClean = signals.reviewer_name.trim();
  if (nameClean.length < 3 || /^(.)\1+$/.test(nameClean) || /^\d+$/.test(nameClean)) {
    score -= 15;
    flags.push("suspicious_name");
  }

  return {
    trust_score: Math.max(0, Math.min(100, score)),
    flags,
  };
}
