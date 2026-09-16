import type { SupabaseClient, User } from "@supabase/supabase-js";

// Same loose client shape as MirrorClient in github-identity.ts, for the same
// reason: callers hold clients typed against disagreeing Database types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ReferralClient = Pick<SupabaseClient<any, any, any>, "from">;

/** A referral credits a signup, not an account that has been around a while. */
export const REFERRAL_WINDOW_DAYS = 30;

export type ReferralResult =
  | { credited: true }
  | {
      credited: false;
      reason:
        | "not_a_new_signup"
        | "unknown_referrer"
        | "self_referral"
        | "already_referred";
    };

const UNIQUE_VIOLATION = "23505";

/**
 * Credit the builder whose referral link brought `user` here: record the
 * referral, recount the referrer's `referral_count`, and give the referrer the
 * streak day the referral prompt promises ("every signup earns you a streak
 * day").
 *
 * Needs the service-role client. Every write lands on the referrer's rows,
 * which RLS keeps out of the browser's reach — which is why the in-browser
 * version this replaces never recorded a single referral. Throws on
 * unexpected database errors.
 */
export async function creditReferral(
  sb: ReferralClient,
  user: Pick<User, "id" | "created_at">,
  referrerUsername: string,
  now: Date = new Date(),
): Promise<ReferralResult> {
  const accountAgeMs = now.getTime() - Date.parse(user.created_at);
  // Negated so an unparseable created_at (NaN) is refused as well.
  if (!(accountAgeMs <= REFERRAL_WINDOW_DAYS * 86_400_000)) {
    return { credited: false, reason: "not_a_new_signup" };
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
  const { error: insertError } = await sb
    .from("referrals")
    .insert({ referrer_id: referrer.id, referred_id: user.id });
  if (insertError?.code === UNIQUE_VIOLATION) {
    return { credited: false, reason: "already_referred" };
  }
  if (insertError) throw insertError;

  const { count, error: countError } = await sb
    .from("referrals")
    .select("id", { count: "exact", head: true })
    .eq("referrer_id", referrer.id);
  if (countError) throw countError;

  const [{ error: countUpdateError }, { error: streakError }] =
    await Promise.all([
      // Recounted rather than incremented: a count that ever drifts from the
      // referrals table is corrected by the next referral.
      sb
        .from("users")
        .update({ referral_count: count ?? 0 })
        .eq("id", referrer.id),
      // ignoreDuplicates leaves a day the referrer already logged untouched.
      sb
        .from("streak_logs")
        .upsert(
          { user_id: referrer.id, activity_date: now.toISOString().slice(0, 10) },
          { onConflict: "user_id,activity_date", ignoreDuplicates: true },
        ),
    ]);
  if (countUpdateError) throw countUpdateError;
  if (streakError) throw streakError;

  return { credited: true };
}
