import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { messagesLimiter, getIP, checkRateLimit } from "@/lib/rate-limit";

// GET /api/streak/today-logged?date=YYYY-MM-DD
// Returns { loggedToday: boolean } for the authenticated user.
//
// Why the date is required: streak_logs.activity_date is written using the
// client's local YYYY-MM-DD (see POST /api/streak). If we silently fell back
// to the server's UTC date here, evening-timezone users would get the wrong
// answer and the navbar dot would flicker. Force the client to be explicit.
export async function GET(request: NextRequest) {
  // Same limiter the streak POST uses — 60/min per IP. Enough headroom for
  // navbar refetches on focus changes; cheap insurance against scripted abuse.
  const { success } = await checkRateLimit(messagesLimiter, getIP(request));
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientDate = request.nextUrl.searchParams.get("date");
  if (!clientDate || !/^\d{4}-\d{2}-\d{2}$/.test(clientDate)) {
    return NextResponse.json(
      { error: "Missing or invalid date parameter (expected YYYY-MM-DD)" },
      { status: 400 }
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data, error } = await sb
    .from("streak_logs")
    .select("id")
    .eq("user_id", user.id)
    .eq("activity_date", clientDate)
    .limit(1);

  if (error) {
    console.error("today-logged query failed:", error);
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }

  return NextResponse.json({ loggedToday: !!(data && data.length > 0) });
}
