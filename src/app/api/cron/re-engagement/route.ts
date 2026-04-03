import { NextRequest, NextResponse } from "next/server";
import { runReEngagement } from "@/lib/cron-jobs/re-engagement";

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runReEngagement();
    return NextResponse.json({ message: "Re-engagement check completed", ...result });
  } catch (error) {
    console.error("Re-engagement cron error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
