import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const AUTO_FLAG_THRESHOLD = 3;

// Simple in-memory rate limiter: max 10 reports per IP per hour
const reportRateMap = new Map<string, { count: number; resetAt: number }>();

function isReportRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = reportRateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    reportRateMap.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return false;
  }
  entry.count++;
  return entry.count > 10;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  if (isReportRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many reports. Please try again later." },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const { project_id, reason } = body;

    if (!project_id || typeof project_id !== "string") {
      return NextResponse.json(
        { error: "project_id is required" },
        { status: 400 }
      );
    }

    if (!reason || typeof reason !== "string") {
      return NextResponse.json(
        { error: "reason is required" },
        { status: 400 }
      );
    }

    if (reason.length > 500) {
      return NextResponse.json(
        { error: "reason must be 500 characters or less" },
        { status: 400 }
      );
    }

    // Use direct client (not cookie-based) so unauthenticated users can report
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Insert the report
    const { error: insertError } = await sb.from("project_reports").insert({
      project_id,
      reason,
    });

    if (insertError) {
      console.error("Failed to insert report:", insertError);
      return NextResponse.json(
        { error: "Failed to submit report" },
        { status: 500 }
      );
    }

    // Count total reports for this project
    const { count, error: countError } = await sb
      .from("project_reports")
      .select("*", { count: "exact", head: true })
      .eq("project_id", project_id);

    if (countError) {
      console.error("Failed to count reports:", countError);
      // Report was still inserted, so return success
      return NextResponse.json({ success: true, flagged: false });
    }

    // Auto-flag project if threshold reached
    let flagged = false;
    if (count !== null && count >= AUTO_FLAG_THRESHOLD) {
      const { error: flagError } = await sb
        .from("projects")
        .update({ flagged: true })
        .eq("id", project_id);

      if (flagError) {
        console.error("Failed to flag project:", flagError);
      } else {
        flagged = true;
      }
    }

    return NextResponse.json({ success: true, flagged });
  } catch (err) {
    console.error("Report API error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
