import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { messagesLimiter, getIP, checkRateLimit } from "@/lib/rate-limit";

// Recalculate only the signed-in user's score. The underlying SECURITY DEFINER
// function is not callable by browser roles; this route binds its argument to
// the verified session before using the service role.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const [{ success }, { data: { user } }] = await Promise.all([
      checkRateLimit(messagesLimiter, getIP(request)),
      supabase.auth.getUser(),
    ]);

    if (!success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await createAdminClient().rpc("update_user_streak", {
      p_user_id: user.id,
    });
    if (error) {
      console.error("Failed to recalculate streak:", error);
      return NextResponse.json({ error: "Failed to recalculate streak" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Streak recalculation error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
