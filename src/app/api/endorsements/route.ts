import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { endorsementsLimiter, getIP, checkRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

// Bust cached profile data for the project owner so their new vibe_score
// shows up immediately instead of waiting for the 60s/1h cache to expire.
async function revalidateOwnerProfile(ownerId: string) {
  try {
    const adminSb = createAdminClient();
    const { data: owner } = await adminSb
      .from("users")
      .select("username")
      .eq("id", ownerId)
      .single();

    if (owner?.username) {
      revalidateTag(`user-${owner.username}`, { expire: 0 });
      revalidatePath(`/profile/${owner.username}`);
    }
  } catch (err) {
    console.error("Failed to revalidate owner profile:", err);
  }
}

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

    // Anti-gaming: check account age (must be at least 7 days old)
    const { data: endorserProfile } = await sb
      .from("users")
      .select("created_at, streak, vibe_score")
      .eq("id", user.id)
      .single();

    if (endorserProfile) {
      const accountAge = Date.now() - new Date(endorserProfile.created_at).getTime();
      const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
      if (accountAge < SEVEN_DAYS) {
        return NextResponse.json(
          { error: "Your account must be at least 7 days old to endorse projects" },
          { status: 403 }
        );
      }
    }

    // Anti-gaming: check endorser has at least some activity (1+ projects or streak > 0)
    const { count: endorserProjectCount } = await sb
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    if (
      endorserProfile &&
      (endorserProjectCount ?? 0) === 0 &&
      endorserProfile.streak === 0 &&
      endorserProfile.vibe_score === 0
    ) {
      return NextResponse.json(
        { error: "Add a project or log activity before endorsing others" },
        { status: 403 }
      );
    }

    // Anti-gaming: limit total endorsements per user per day (max 10)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: recentEndorsements } = await sb
      .from("project_endorsements")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", oneDayAgo);

    if ((recentEndorsements ?? 0) >= 10) {
      return NextResponse.json(
        { error: "You can endorse up to 10 projects per day" },
        { status: 429 }
      );
    }

    // Explicit duplicate check before insert (belt and suspenders with DB unique constraint)
    const { data: existingEndorsement } = await sb
      .from("project_endorsements")
      .select("id")
      .eq("project_id", project_id)
      .eq("user_id", user.id)
      .single();

    if (existingEndorsement) {
      // Return current count so client can sync without extra fetch
      const adminSb = createAdminClient();
      const { count: currentCount } = await adminSb
        .from("project_endorsements")
        .select("id", { count: "exact", head: true })
        .eq("project_id", project_id);
      return NextResponse.json(
        { error: "You already endorsed this project", count: currentCount || 0 },
        { status: 409 }
      );
    }

    // Insert endorsement (unique constraint prevents duplicates)
    const { error } = await sb
      .from("project_endorsements")
      .insert({ project_id, user_id: user.id });

    if (error) {
      if (error.code === "23505") {
        const adminSb = createAdminClient();
        const { count: currentCount } = await adminSb
          .from("project_endorsements")
          .select("id", { count: "exact", head: true })
          .eq("project_id", project_id);
        return NextResponse.json(
          { error: "You already endorsed this project", count: currentCount || 0 },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: "Failed to endorse" }, { status: 500 });
    }

    // Update cached count on project using service role to bypass RLS
    {
      const adminSb = createAdminClient();
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

      // Invalidate the owner's profile cache so the +5 vibe_score shows up right away
      await revalidateOwnerProfile(project.user_id);

      return NextResponse.json({ success: true, count: count || 0 });
    }
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
    {
      const adminSb = createAdminClient();
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

      // Look up the project owner so we can bust their profile cache
      const { data: project } = await adminSb
        .from("projects")
        .select("user_id")
        .eq("id", project_id)
        .single();

      if (project?.user_id) {
        await revalidateOwnerProfile(project.user_id);
      }

      return NextResponse.json({ success: true, count: count || 0 });
    }
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
