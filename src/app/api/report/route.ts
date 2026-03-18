import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

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

function getSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
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

    const sb = getSb();

    // Generate reporter_token server-side for undo support
    const reporter_token = randomUUID();

    const { data: inserted, error: insertError } = await sb
      .from("project_reports")
      .insert({ project_id, reason, reporter_token })
      .select("id")
      .single();

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
      return NextResponse.json({ success: true, flagged: false, report_id: inserted?.id, reporter_token });
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

    return NextResponse.json({ success: true, flagged, report_id: inserted?.id, reporter_token });
  } catch (err) {
    console.error("Report API error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { report_id, reporter_token } = body;

    if (!report_id || typeof report_id !== "string") {
      return NextResponse.json({ error: "report_id is required" }, { status: 400 });
    }

    if (!reporter_token || typeof reporter_token !== "string") {
      return NextResponse.json({ error: "reporter_token is required" }, { status: 400 });
    }

    const sb = getSb();

    // Fetch the report to verify token and get project_id
    const { data: report, error: fetchError } = await sb
      .from("project_reports")
      .select("id, project_id, reporter_token")
      .eq("id", report_id)
      .single();

    if (fetchError || !report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    if (report.reporter_token !== reporter_token) {
      return NextResponse.json({ error: "Invalid token" }, { status: 403 });
    }

    // Delete the report
    const { error: deleteError } = await sb
      .from("project_reports")
      .delete()
      .eq("id", report_id);

    if (deleteError) {
      console.error("Failed to delete report:", deleteError);
      return NextResponse.json({ error: "Failed to undo report" }, { status: 500 });
    }

    // Recount reports and unflag if below threshold
    const { count } = await sb
      .from("project_reports")
      .select("*", { count: "exact", head: true })
      .eq("project_id", report.project_id);

    if (count !== null && count < AUTO_FLAG_THRESHOLD) {
      await sb
        .from("projects")
        .update({ flagged: false })
        .eq("id", report.project_id);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Report DELETE error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
