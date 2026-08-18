import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchVibeUsdCached } from "@/lib/promotion-pricing";
import { fetchVibeBalance, isBalanceStale, toWholeVibe, balanceUsd } from "@/lib/vibe-balance";
import { freezeAllowanceFor, BASE_FREEZES } from "@/lib/vibe-config";

// On-demand balance refresh for the tier display.
//
// The monthly cron is what GRANTS an allowance; this only keeps the displayed
// balance current between grants, so it is deliberately cheap and cached.

export async function POST() {
  try {
    const authClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
    }

    const sb = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: me } = await (sb as any)
      .from("users")
      .select("solana_wallet, vibe_balance, vibe_balance_at")
      .eq("id", user.id)
      .single();

    if (!me?.solana_wallet) {
      return NextResponse.json({ error: "No wallet linked." }, { status: 400 });
    }

    let base = BigInt(me.vibe_balance ?? 0);
    let cached = true;

    if (isBalanceStale(me.vibe_balance_at)) {
      const fresh = await fetchVibeBalance(me.solana_wallet);
      // null means the RPC failed, not that they hold nothing — keep the cached
      // value rather than flashing a zero balance at the user.
      if (fresh != null) {
        base = fresh;
        cached = false;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (sb as any)
          .from("users")
          .update({ vibe_balance: base.toString(), vibe_balance_at: new Date().toISOString() })
          .eq("id", user.id);
      }
    }

    let usd = 0;
    try {
      usd = balanceUsd(base, await fetchVibeUsdCached());
    } catch {
      // Price unavailable — report the token balance without a USD figure
      // rather than failing the whole request.
    }

    return NextResponse.json({
      balance: base.toString(),
      wholeTokens: toWholeVibe(base),
      usd,
      // What they'd be granted at the next monthly reset. The allowance in
      // force right now was set on the 1st and does not move mid-month.
      freezes: usd > 0 ? freezeAllowanceFor(usd) : BASE_FREEZES,
      cached,
    });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
