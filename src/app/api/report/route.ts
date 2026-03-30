import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { reportLimiter, getIP, checkRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

const AUTO_FLAG_THRESHOLD = 3;

export async function POST(req: NextRequest) {
  const { success } = await checkRateLimit(reportLimiter, getIP(req));
  if (!success) {
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

    const sb = createAdminClient();

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

    const sb = createAdminClient();

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
