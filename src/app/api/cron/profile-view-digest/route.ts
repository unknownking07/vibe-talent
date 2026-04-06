import { NextRequest, NextResponse } from "next/server";
import { runProfileViewDigest } from "@/lib/cron-jobs/profile-view-digest";

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
    const result = await runProfileViewDigest();
    return NextResponse.json({ message: "Profile view digest completed", ...result });
  } catch (error) {
    console.error("Profile view digest cron error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
