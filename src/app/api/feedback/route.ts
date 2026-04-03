import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { username, reason, details, would_return } = body;

    if (!reason) {
      return NextResponse.json({ error: "Reason is required" }, { status: 400 });
    }

    const sb = createAdminClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (sb as any).from("feedback").insert({
      username: username || null,
      reason,
      details: details || null,
      would_return: would_return || null,
      source: "re_engagement_email",
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error("Failed to save feedback:", error);
      return NextResponse.json({ error: "Failed to save feedback" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
