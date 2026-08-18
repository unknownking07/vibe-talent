import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyBurnTransaction } from "@/lib/vibe-burn-verify";
import { STREAK_PROTECT } from "@/lib/vibe-config";

// Burn ~$1 of $VIBE to restore a streak broken within the grace window.
//
// Restoring means filling the gap days in streak_logs (marked source='restore')
// and letting the AFTER INSERT trigger recompute streak + vibe_score — the same
// mechanism the free-freeze path in reset-streaks already uses.

const SIGNATURE_RE = /^[1-9A-HJ-NP-Za-km-z]{64,100}$/;
const DAY_MS = 86_400_000;

function ymd(d: Date): string {
  return d.toISOString().split("T")[0];
}

export async function POST(req: NextRequest) {
  try {
    const authClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
    }

    const { signature, break_date: breakDate } = (await req.json()) ?? {};
    if (typeof signature !== "string" || !SIGNATURE_RE.test(signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
    if (typeof breakDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(breakDate)) {
      return NextResponse.json({ error: "Invalid break_date" }, { status: 400 });
    }

    const sb = createAdminClient();

    // ── Eligibility ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: me } = await (sb as any)
      .from("users")
      .select("id, streak_before_break, streak_broken_at")
      .eq("id", user.id)
      .single();

    if (!me?.streak_broken_at || !me?.streak_before_break) {
      return NextResponse.json(
        { error: "You have no broken streak to restore." },
        { status: 400 },
      );
    }
    if (me.streak_before_break < STREAK_PROTECT.minStreakToOffer) {
      return NextResponse.json(
        {
          error: `Streaks under ${STREAK_PROTECT.minStreakToOffer} days can't be restored.`,
        },
        { status: 400 },
      );
    }
    if (
      Date.now() - new Date(me.streak_broken_at).getTime() >
      STREAK_PROTECT.graceHours * 3_600_000
    ) {
      return NextResponse.json(
        {
          error: `The ${STREAK_PROTECT.graceHours}-hour window to restore this streak has passed.`,
        },
        { status: 400 },
      );
    }

    // Monthly cap — a streak that can be bought back indefinitely stops being
    // a signal about consistency.
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count: usedThisMonth } = await (sb as any)
      .from("streak_protects")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", monthStart.toISOString());
    if ((usedThisMonth ?? 0) >= STREAK_PROTECT.maxPaidPerMonth) {
      return NextResponse.json(
        {
          error: `You've used all ${STREAK_PROTECT.maxPaidPerMonth} streak restores this month.`,
        },
        { status: 429 },
      );
    }

    // ── Work out which days need filling ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: lastLog } = await (sb as any)
      .from("streak_logs")
      .select("activity_date")
      .eq("user_id", user.id)
      .order("activity_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!lastLog?.activity_date) {
      return NextResponse.json({ error: "No activity history to restore." }, { status: 400 });
    }

    const yesterday = new Date(Date.now() - DAY_MS);
    const missing: string[] = [];
    for (
      let t = new Date(`${lastLog.activity_date}T00:00:00Z`).getTime() + DAY_MS;
      t <= yesterday.getTime();
      t += DAY_MS
    ) {
      missing.push(ymd(new Date(t)));
    }
    if (missing.length === 0) {
      return NextResponse.json({ error: "Your streak isn't broken." }, { status: 400 });
    }
    if (missing.length > STREAK_PROTECT.maxGapDays) {
      return NextResponse.json(
        {
          error: `You've missed ${missing.length} days — only up to ${STREAK_PROTECT.maxGapDays} can be restored.`,
        },
        { status: 400 },
      );
    }

    // ── Replay: a signature can only ever be claimed once ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (sb as any)
      .from("streak_protects")
      .select("id")
      .eq("tx_ref", signature)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ error: "This transaction was already used." }, { status: 409 });
    }

    // ── Verify the burn (memo must name THIS user and THIS break date) ──
    const verdict = await verifyBurnTransaction(
      signature,
      { kind: "protect", actorId: user.id, breakDate },
      STREAK_PROTECT.usdPrice,
    );
    if (!verdict.ok) {
      return NextResponse.json({ error: verdict.error }, { status: verdict.status });
    }

    // ── Record the burn BEFORE granting ──
    // The unique index on tx_ref is the real replay guard: two concurrent
    // requests with the same signature both pass the check above, but only one
    // can insert. Doing this first means a duplicate fails here rather than
    // after the streak has already been restored twice.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: recordErr } = await (sb as any).from("streak_protects").insert({
      user_id: user.id,
      vibe_burned: verdict.burned.toString(),
      usd_at_burn: STREAK_PROTECT.usdPrice,
      tx_ref: signature,
      streak_restored: me.streak_before_break,
      days_filled: missing.length,
    });
    if (recordErr) {
      // 23505 = unique_violation on tx_ref, i.e. a concurrent duplicate.
      if ((recordErr as { code?: string }).code === "23505") {
        return NextResponse.json(
          { error: "This transaction was already used." },
          { status: 409 },
        );
      }
      console.error("Failed to record streak protect:", recordErr);
      return NextResponse.json({ error: "Couldn't record that burn." }, { status: 500 });
    }

    // ── Grant: fill the gap; the trigger recomputes streak + vibe_score ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: logsErr } = await (sb as any).from("streak_logs").upsert(
      missing.map((d) => ({ user_id: user.id, activity_date: d, source: "restore" })),
      { onConflict: "user_id,activity_date", ignoreDuplicates: true },
    );
    if (logsErr) {
      console.error("Failed to insert restore logs:", logsErr);
      return NextResponse.json({ error: "Couldn't restore your streak." }, { status: 500 });
    }

    // Clear the break markers so the offer disappears.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb as any)
      .from("users")
      .update({ streak_broken_at: null, streak_before_break: null })
      .eq("id", user.id);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: after } = await (sb as any)
      .from("users")
      .select("streak")
      .eq("id", user.id)
      .single();

    return NextResponse.json({
      ok: true,
      streak: after?.streak ?? me.streak_before_break,
      daysRestored: missing.length,
      vibeBurned: verdict.burned.toString(),
      signature,
    });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
