import type { SupabaseClient, User } from "@supabase/supabase-js";

import { readGithubIdentity } from "@/lib/github-identity";

// Same loose client shape as MirrorClient in github-identity.ts, for the same
// reason: callers hold clients typed against disagreeing Database types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ReferralClient = Pick<SupabaseClient<any, any, any>, "from">;

/** A referral credits a signup, not an account that has been around a while. */
export const REFERRAL_WINDOW_DAYS = 30;

export type ReferralRefusal =
  | "not_a_new_signup"
  | "github_not_verified"
  | "unknown_referrer"
  | "self_referral"
  | "already_referred";

export type ReferralResult =
  | { credited: true }
  | { credited: false; reason: ReferralRefusal };

type ReferredUser = Pick<User, "id" | "created_at" | "identities" | "user_metadata">;

const DAY_MS = 86_400_000;
const UNIQUE_VIOLATION = "23505";

/**
 * Credit the builder whose referral link brought `user` here: record the
 * referral, bring the referrer's `referral_count` up to date, and give the
 * referrer the streak day the referral prompt promises ("every signup earns
 * you a streak day").
 *
 * Needs the service-role client. Every write lands on the referrer's rows,
 * which RLS keeps out of the browser's reach — why the in-browser version
 * this replaces never recorded a single referral.
 *
 * Safe to call again after a failure: a retry for the same referrer finishes
 * whatever the first attempt left undone, and can never credit twice. Throws
 * on unexpected database errors.
 */
export async function creditReferral(
  sb: ReferralClient,
  user: ReferredUser,
  referrerUsername: string,
  now: Date = new Date(),
): Promise<ReferralResult> {
  const accountAgeMs = now.getTime() - Date.parse(user.created_at);
  // Negated so an unparseable created_at (NaN) is refused as well.
  if (!(accountAgeMs <= REFERRAL_WINDOW_DAYS * DAY_MS)) {
    return { credited: false, reason: "not_a_new_signup" };
  }
  // A referral is a builder, not an inbox. Without a proved GitHub identity,
  // throwaway email accounts could farm credit for whoever they name.
  if (!readGithubIdentity(user as User)) {
    return { credited: false, reason: "github_not_verified" };
  }

  const { data: referrer, error: lookupError } = await sb
    .from("users")
    .select("id")
    .eq("username", referrerUsername.trim().toLowerCase())
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (!referrer) return { credited: false, reason: "unknown_referrer" };
  if (referrer.id === user.id) {
    return { credited: false, reason: "self_referral" };
  }

  // referrals.referred_id is UNIQUE, so this insert is the once-per-account gate.
  const inserted = await sb
    .from("referrals")
    .insert({ referrer_id: referrer.id, referred_id: user.id })
    .select("referrer_id, created_at")
    .single();

  let referredAt: string;
  if (!inserted.error) {
    referredAt = inserted.data.created_at;
  } else if (inserted.error.code === UNIQUE_VIOLATION) {
    const existing = await sb
      .from("referrals")
      .select("referrer_id, created_at")
      .eq("referred_id", user.id)
      .single();
    if (existing.error) throw existing.error;
    if (existing.data.referrer_id !== referrer.id) {
      return { credited: false, reason: "already_referred" };
    }
    // Same referrer: a retry of an attempt that failed after its insert.
    referredAt = existing.data.created_at;
  } else {
    throw inserted.error;
  }

  await applyReferralCredit(sb, referrer.id, referredAt);
  return { credited: true };
}

/**
 * The referral's effects on the referrer, safe to repeat. The streak day is
 * the referral's own date, so a retry cannot award a second one, and the
 * count only ever moves up to the true total.
 */
async function applyReferralCredit(
  sb: ReferralClient,
  referrerId: string,
  referredAt: string,
): Promise<void> {
  const { count, error: countError } = await sb
    .from("referrals")
    .select("id", { count: "exact", head: true })
    .eq("referrer_id", referrerId);
  if (countError) throw countError;
  const total = count ?? 0;

  const [{ error: countUpdateError }, { error: streakError }] =
    await Promise.all([
      // Only where the stored count is lower: a request that counted before a
      // concurrent referral landed cannot overwrite the newer, higher total.
      sb
        .from("users")
        .update({ referral_count: total })
        .eq("id", referrerId)
        .lt("referral_count", total),
      sb
        .from("streak_logs")
        .upsert(
          { user_id: referrerId, activity_date: referredAt.slice(0, 10) },
          { onConflict: "user_id,activity_date", ignoreDuplicates: true },
        ),
    ]);
  if (countUpdateError) throw countUpdateError;
  if (streakError) throw streakError;
}
