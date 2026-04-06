import { NextRequest, NextResponse } from "next/server";
import { runWeeklyDigest } from "@/lib/cron-jobs/weekly-digest";

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
    const result = await runWeeklyDigest();
    return NextResponse.json({ message: "Weekly digest completed", ...result });
  } catch (error) {
    console.error("Weekly digest cron error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
