import { after, NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseFounderBrief } from "@/lib/founder-brief";
import { sendFounderBriefNotification } from "@/lib/email";
import { checkRateLimit, founderBriefLimiter, getIP } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const { success } = await checkRateLimit(founderBriefLimiter, getIP(request));
  if (!success) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Enter your project and contact details." }, { status: 400 });
  }
  const parsed = parseFounderBrief(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recent, error: recentError } = await admin
      .from("founder_briefs")
      .select("id")
      .eq("email", parsed.value.email)
      .gte("created_at", since)
      .limit(3);
    if (recentError) {
      console.error("Founder brief repeat check failed", recentError);
      return NextResponse.json({ error: "Could not save your brief. Try again shortly." }, { status: 503 });
    }
    if ((recent?.length ?? 0) >= 3) {
      return NextResponse.json({ error: "You've sent several requests today. Please try tomorrow." }, { status: 429 });
    }

    const { data, error } = await admin
      .from("founder_briefs")
      .insert(parsed.value)
      .select("id")
      .single();
    if (error || !data) {
      console.error("Founder brief insert failed", error);
      return NextResponse.json({ error: "Could not save your brief. Try again." }, { status: 500 });
    }

    after(async () => {
      try {
        await sendFounderBriefNotification({ ...parsed.value, id: data.id });
      } catch (error) {
        console.error("Founder brief notification failed", error);
      }
    });
    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (error) {
    console.error("Founder brief submission failed", error);
    return NextResponse.json({ error: "Could not save your brief. Try again." }, { status: 500 });
  }
}
