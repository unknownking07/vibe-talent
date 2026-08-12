import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { vouchLimiter, getIP, checkRateLimit } from "@/lib/rate-limit";
import { stagingOnlyResponse } from "@/lib/staging";
import { verifyBurnTransaction } from "@/lib/vibe-burn-verify";
import { VOUCH } from "@/lib/vibe-config";

// Burn $VIBE to publicly back a builder.
//
// The burn is permanent and the display is uncapped — that is the feature. The
// contribution to vibe_score is capped hard (see the vouch term in
// update_user_streak) so conviction is visible without rank being purchasable.

const SIGNATURE_RE = /^[1-9A-HJ-NP-Za-km-z]{64,100}$/;

export async function POST(req: NextRequest) {
  const gate = stagingOnlyResponse();
  if (gate) return gate;

  try {
    const authClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
    }

    const { success } = await checkRateLimit(vouchLimiter, getIP(req));
    if (!success) {
      return NextResponse.json(
        { error: "Too many attempts. Please wait a moment." },
        { status: 429 },
      );
    }

    const { builder_username: builderUsername, usd, signature } = (await req.json()) ?? {};
    if (typeof signature !== "string" || !SIGNATURE_RE.test(signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
    if (typeof builderUsername !== "string" || !builderUsername.trim()) {
      return NextResponse.json({ error: "Invalid builder" }, { status: 400 });
    }
    const usdAmount = Number(usd);
    if (!Number.isFinite(usdAmount) || usdAmount < VOUCH.minUsd) {
      return NextResponse.json(
        { error: `The minimum vouch is $${VOUCH.minUsd}.` },
        { status: 400 },
      );
    }

    const sb = createAdminClient();

    // Resolve the builder. A clear message beats tripping the
    // vouches_no_self_vouch constraint.
    const { data: builder } = await sb
      .from("users")
      .select("id, username")
      .eq("username", builderUsername)
      .single();
    if (!builder) {
      return NextResponse.json({ error: "Builder not found." }, { status: 404 });
    }
    if (builder.id === user.id) {
      return NextResponse.json({ error: "You can't vouch for yourself." }, { status: 400 });
    }

    // Replay pre-check (the unique index below is the real guard).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (sb as any)
      .from("vouches")
      .select("id")
      .eq("tx_ref", signature)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ error: "This transaction was already used." }, { status: 409 });
    }

    // The memo must name this voucher AND this builder, so a burn broadcast by
    // someone else cannot be claimed here.
    const verdict = await verifyBurnTransaction(
      signature,
      { kind: "vouch", actorId: user.id, targetId: builder.id },
      usdAmount,
    );
    if (!verdict.ok) {
      return NextResponse.json({ error: verdict.error }, { status: verdict.status });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insErr } = await (sb as any).from("vouches").insert({
      voucher_id: user.id,
      builder_id: builder.id,
      vibe_burned: verdict.burned.toString(),
      usd_at_burn: usdAmount,
      tx_ref: signature,
    });
    if (insErr) {
      if ((insErr as { code?: string }).code === "23505") {
        return NextResponse.json(
          { error: "This transaction was already used." },
          { status: 409 },
        );
      }
      console.error("Failed to record vouch:", insErr);
      return NextResponse.json({ error: "Couldn't record that vouch." }, { status: 500 });
    }

    // Recompute the builder's score. Without this the vouch has no effect on
    // vibe_score until their next activity fires the streak_logs trigger.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: rpcErr } = await (sb as any).rpc("update_user_streak", {
      p_user_id: builder.id,
    });
    if (rpcErr) {
      // The burn is recorded and will count on the next recompute; don't fail
      // a completed on-chain action over a scoring refresh.
      console.error("Failed to recompute score after vouch:", rpcErr);
    }

    // Bust the builder's cached profile so the backer appears immediately.
    try {
      revalidateTag(`user-${builder.username}`, { expire: 0 });
      revalidatePath(`/profile/${builder.username}`);
    } catch (err) {
      console.error("Failed to revalidate builder profile:", err);
    }

    return NextResponse.json({
      ok: true,
      builder: builder.username,
      vibeBurned: verdict.burned.toString(),
      usd: usdAmount,
      signature,
    });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
