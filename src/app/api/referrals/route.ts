import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { creditReferral } from "@/lib/referrals";

// POST /api/referrals — credit the builder whose referral link brought the
// signed-in user here. Called once, when onboarding completes.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const referrer = (body as { referrer?: unknown }).referrer;
    if (typeof referrer !== "string" || !referrer.trim()) {
      return NextResponse.json(
        { error: "referrer is required" },
        { status: 400 }
      );
    }

    const result = await creditReferral(createAdminClient(), user, referrer);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to credit referral:", error);
    return NextResponse.json(
      { error: "Failed to credit referral" },
      { status: 500 }
    );
  }
}
