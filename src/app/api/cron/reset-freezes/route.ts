import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchVibeUsdCached } from "@/lib/promotion-pricing";
import { fetchVibeBalance, balanceUsd } from "@/lib/vibe-balance";
import { BASE_FREEZES, freezeAllowanceFor } from "@/lib/vibe-config";

/**
 * Cron job: Reset streak freezes for all users on the 1st of every month.
 * Restores each user's freeze allowance to 2 and resets the used counter.
 *
 * This route is pulled in by the daily orchestrator, so we gate it to the 1st
 * of the month here. Without the gate, freezes would reset every day and the
 * "2 per month" allowance would effectively be unlimited.
 *
 * Override the date check with ?force=1 for one-off manual resets.
 *
 * Protected by CRON_SECRET to prevent unauthorized access.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  // Fail closed: in production a missing CRON_SECRET would otherwise make this
  // route unauthenticated and any caller could wipe everyone's freeze counters
  // (especially via ?force=1).
  if (!cronSecret && process.env.NODE_ENV === "production") {
    console.error("CRON_SECRET is not configured");
    return NextResponse.json({ error: "Cron secret not configured" }, { status: 500 });
  }
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const force = req.nextUrl.searchParams.get("force") === "1";
  const dayOfMonth = new Date().getUTCDate();
  if (!force && dayOfMonth !== 1) {
    return NextResponse.json({
      message: `Skipped — freezes only reset on the 1st of the month (today is day ${dayOfMonth}). Pass ?force=1 to override.`,
      count: 0,
    });
  }

  const supabase = createAdminClient();

  try {
    // Everyone starts from the base allowance; $VIBE holders are raised below.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count, error } = await (supabase as any)
      .from("users")
      .update({
        streak_freezes_remaining: BASE_FREEZES,
        streak_freezes_used: 0,
      })
      .neq("id", "")
      .select("id", { count: "exact", head: true });

    if (error) {
      console.error("Failed to reset freezes:", error);
      return NextResponse.json({ error: "Failed to reset freezes" }, { status: 500 });
    }

    const resetCount = count ?? 0;
    console.log(`Reset streak freezes for ${resetCount} users`);

    // ── Holder tiers ──
    //
    // Evaluated once, here, at grant time — and the allowance then holds for
    // the whole month regardless of price. At this market cap a single trade
    // moves $VIBE ~30%, so re-checking mid-month would flicker people in and
    // out of their tier.
    //
    // If $VIBE can't be priced, everyone keeps the base allowance: better to
    // under-grant than to hand out a tier we couldn't verify.
    let upgraded = 0;
    let tiersSkipped = false;
    let vibeUsd: number | null = null;
    try {
      vibeUsd = await fetchVibeUsdCached();
    } catch {
      tiersSkipped = true;
      console.warn("Could not price $VIBE — holder tiers skipped this cycle");
    }

    if (vibeUsd != null) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: linked } = await (supabase as any)
        .from("users")
        .select("id, username, solana_wallet")
        .not("solana_wallet", "is", null);

      for (const u of (linked ?? []) as Array<{
        id: string;
        username: string;
        solana_wallet: string;
      }>) {
        const balance = await fetchVibeBalance(u.solana_wallet);
        // null means the RPC failed, not that they hold nothing — skip rather
        // than silently demote someone to the base allowance.
        if (balance == null) {
          console.warn(`Balance unreadable for ${u.username}; left at base allowance`);
          continue;
        }
        const allowance = freezeAllowanceFor(balanceUsd(balance, vibeUsd));

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: tierError } = await (supabase as any)
          .from("users")
          .update({
            streak_freezes_remaining: allowance,
            vibe_balance: balance.toString(),
            vibe_balance_at: new Date().toISOString(),
          })
          .eq("id", u.id);

        if (tierError) {
          console.error(`Failed to grant tier freezes for ${u.username}:`, tierError);
          continue;
        }
        if (allowance > BASE_FREEZES) upgraded++;
      }
    }

    return NextResponse.json({
      message: `Reset freezes for ${resetCount} users, ${upgraded} upgraded by holdings`,
      count: resetCount,
      upgraded,
      ...(tiersSkipped ? { tiersSkipped: true } : {}),
    });
  } catch (error) {
    console.error("Freeze reset cron error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
