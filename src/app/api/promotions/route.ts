import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateUUID } from "@/lib/validation";

// Records an ownership authorization for a featured promotion (audit finding #8).
// The on-chain promote(projectId, ...) call accepts any projectId, so the render
// path only shows a promotion if its payer was authorized here — and only the
// project's OWNER (verified from the session) can create that authorization.
//
// EVM (Base) only. Solana payments will record promotions through a dedicated
// /api/solana/verify endpoint in the next phase.

const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const ALLOWED_CHAINS = new Set(["base"]);

export async function POST(req: NextRequest) {
  try {
    // 1. Require an authenticated session.
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
    }

    // 2. Validate input.
    const body = await req.json();
    const { project_id, wallet_address, tx_ref, chain } = body ?? {};

    if (!project_id || !validateUUID(project_id)) {
      return NextResponse.json({ error: "Invalid project_id" }, { status: 400 });
    }
    if (typeof wallet_address !== "string" || !EVM_ADDRESS.test(wallet_address)) {
      return NextResponse.json({ error: "Invalid wallet_address" }, { status: 400 });
    }
    const chainClean = typeof chain === "string" && chain.length > 0 ? chain : "base";
    if (!ALLOWED_CHAINS.has(chainClean)) {
      return NextResponse.json({ error: "Unsupported chain" }, { status: 400 });
    }
    const txRef =
      typeof tx_ref === "string" && tx_ref.length > 0 ? tx_ref.slice(0, 120) : null;

    const sb = createAdminClient();

    // 3. Ownership gate — THE security check. Only the project's owner may
    //    authorize a promotion of it.
    const { data: project, error: projErr } = await sb
      .from("projects")
      .select("id, user_id")
      .eq("id", project_id)
      .single();

    if (projErr || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    if (project.user_id !== user.id) {
      return NextResponse.json(
        { error: "You can only promote your own project." },
        { status: 403 }
      );
    }

    // 4. Record the authorization (idempotent on tx_ref).
    const { error: upsertErr } = await sb
      .from("featured_promotions")
      .upsert(
        {
          project_id,
          user_id: user.id,
          promoter_wallet: wallet_address.toLowerCase(),
          chain: chainClean,
          tx_ref: txRef,
        },
        { onConflict: "tx_ref" }
      );

    if (upsertErr) {
      console.error("Failed to record promotion authorization:", upsertErr);
      return NextResponse.json({ error: "Failed to record authorization" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
