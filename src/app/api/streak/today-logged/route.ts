import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// GET /api/streak/today-logged?date=YYYY-MM-DD — returns { loggedToday }
//
// Used by the navbar to decide whether to show the "unlogged activity" dot on
// the Dashboard link. The client passes its local calendar date so the check
// matches what POST /api/streak writes (also client-local).
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ loggedToday: false });
  }

  const clientDate = request.nextUrl.searchParams.get("date");
  const activityDate =
    clientDate && /^\d{4}-\d{2}-\d{2}$/.test(clientDate)
      ? clientDate
      : new Date().toISOString().split("T")[0];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data, error } = await sb
    .from("streak_logs")
    .select("id")
    .eq("user_id", user.id)
    .eq("activity_date", activityDate)
    .limit(1);

  if (error) {
    console.error("today-logged query failed:", error);
    return NextResponse.json({ loggedToday: false });
  }

  return NextResponse.json({ loggedToday: !!(data && data.length > 0) });
}
