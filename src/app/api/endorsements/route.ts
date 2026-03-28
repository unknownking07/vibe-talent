import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { endorsementsLimiter, getIP, checkRateLimit } from "@/lib/rate-limit";
import { createClient } from "@supabase/supabase-js";

/**
 * Project Endorsements API
 *
 * Authenticated users can endorse projects they find valuable.
 * Anti-gaming rules:
 *   - Cannot endorse your own projects
 *   - One endorsement per user per project
 *   - Must be authenticated (no anonymous spam)
 *   - Endorsements from higher-scored users weigh more (computed at read time)
 */

// GET /api/endorsements?project_id=xxx — Get endorsement count + whether current user endorsed
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("project_id");

    if (!projectId) {
      return NextResponse.json({ error: "project_id is required" }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;

    // Get count
    const { count, error } = await sb
      .from("project_endorsements")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId);

    if (error) {
      return NextResponse.json({ error: "Failed to fetch endorsements" }, { status: 500 });
    }

    // Check if current user endorsed
    let userEndorsed = false;
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: existing } = await sb
        .from("project_endorsements")
        .select("id")
        .eq("project_id", projectId)
        .eq("user_id", user.id)
        .single();
      userEndorsed = !!existing;
    }

    return NextResponse.json({
      count: count || 0,
      user_endorsed: userEndorsed,
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST /api/endorsements — Endorse a project
export async function POST(req: NextRequest) {
  const { success } = await checkRateLimit(endorsementsLimiter, getIP(req));
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Sign in to endorse projects" }, { status: 401 });
    }

    const { project_id } = await req.json();
    if (!project_id) {
      return NextResponse.json({ error: "project_id is required" }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;

    // Check project exists and user doesn't own it
    const { data: project, error: projErr } = await sb
      .from("projects")
      .select("id, user_id")
      .eq("id", project_id)
      .single();

    if (projErr || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (project.user_id === user.id) {
      return NextResponse.json({ error: "You cannot endorse your own project" }, { status: 403 });
    }

    // Insert endorsement (unique constraint prevents duplicates)
    const { error } = await sb
      .from("project_endorsements")
      .insert({ project_id, user_id: user.id });

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "You already endorsed this project" }, { status: 409 });
      }
      return NextResponse.json({ error: "Failed to endorse" }, { status: 500 });
    }

    // Update cached count on project using service role to bypass RLS
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceRoleKey) {
      const adminSb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey);
      const { count } = await adminSb
        .from("project_endorsements")
        .select("id", { count: "exact", head: true })
        .eq("project_id", project_id);

      const { error: updateErr } = await adminSb
        .from("projects")
        .update({ endorsement_count: count || 0 })
        .eq("id", project_id);

      if (updateErr) {
        console.error("Failed to update endorsement cache:", updateErr);
      }

      return NextResponse.json({ success: true, count: count || 0 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE /api/endorsements — Remove endorsement
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { project_id } = await req.json();
    if (!project_id) {
      return NextResponse.json({ error: "project_id is required" }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;

    await sb
      .from("project_endorsements")
      .delete()
      .eq("project_id", project_id)
      .eq("user_id", user.id);

    // Update cached count using service role to bypass RLS
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceRoleKey) {
      const adminSb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey);
      const { count } = await adminSb
        .from("project_endorsements")
        .select("id", { count: "exact", head: true })
        .eq("project_id", project_id);

      const { error: updateErr } = await adminSb
        .from("projects")
        .update({ endorsement_count: count || 0 })
        .eq("id", project_id);

      if (updateErr) {
        console.error("Failed to update endorsement cache:", updateErr);
      }

      return NextResponse.json({ success: true, count: count || 0 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
