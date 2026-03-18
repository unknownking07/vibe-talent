import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const AUTO_FLAG_THRESHOLD = 3;

export async function POST(req: NextRequest) {
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
    if (count >= AUTO_FLAG_THRESHOLD) {
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
