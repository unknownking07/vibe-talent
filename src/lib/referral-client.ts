import type { ReferralResult } from "@/lib/referrals";

/** Where /auth/signup keeps a `?ref=` code until the account can use it. */
export const REFERRAL_CODE_KEY = "referral_code";

/**
 * Send the referral code saved at signup, if there is one, to /api/referrals.
 *
 * The code survives any outcome that could still change on a later visit — a
 * network failure, a 5xx, a 401, or an account that hasn't verified GitHub
 * yet — so onboarding and the dashboard both call this. It is dropped once
 * the referral is credited or refused for good. Never throws.
 */
export async function submitPendingReferral(): Promise<void> {
  try {
    const referrer = localStorage.getItem(REFERRAL_CODE_KEY);
    if (!referrer) return;

    const res = await fetch("/api/referrals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ referrer }),
    });
    if (res.status === 401 || res.status >= 500) return;
    if (res.ok) {
      const result = (await res.json()) as ReferralResult;
      if (!result.credited && result.reason === "github_not_verified") return;
    }
    localStorage.removeItem(REFERRAL_CODE_KEY);
  } catch {
    // Network failure or unreadable response: keep the code for next time.
  }
}
