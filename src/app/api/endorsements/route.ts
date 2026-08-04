import { NextRequest, NextResponse, after } from "next/server";
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

// Upper bound on a single batch. A page renders at most a few dozen cards, and
// this keeps one request from turning into an unbounded `IN (...)` scan.
const MAX_BATCH_PROJECT_IDS = 50;

/**
 * GET /api/endorsements
 *
 * Accepts either:
 *   ?project_id=xxx    -> { count, user_endorsed }
 *   ?project_ids=a,b,c -> { results: { a: { count, user_endorsed }, ... } }
 *
 * The batch form exists because every card mounts its own EndorseButton. One
 * request per card meant a page of 12 projects fired 12 round trips, each a
 * separate Worker invocation and each re-running `auth.getUser()`. Batched, any
 * number of cards costs two queries and one auth check.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const singleId = searchParams.get("project_id");
    const batchParam = searchParams.get("project_ids");

    if (!singleId && !batchParam) {
      return NextResponse.json({ error: "project_id is required" }, { status: 400 });
    }

    const projectIds = batchParam
      ? [...new Set(batchParam.split(",").map((id) => id.trim()).filter(Boolean))]
      : [singleId as string];

    if (projectIds.length === 0) {
      return NextResponse.json({ error: "project_ids is empty" }, { status: 400 });
    }
    if (projectIds.length > MAX_BATCH_PROJECT_IDS) {
      return NextResponse.json(
        { error: `project_ids accepts at most ${MAX_BATCH_PROJECT_IDS} ids` },
        { status: 400 },
      );
    }

    const supabase = await createServerSupabaseClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;

    // One row per endorsement across every requested project, tallied below.
    // `head: true` counting can't group, so this reads the ids and counts them.
    const { data: rows, error } = await sb
      .from("project_endorsements")
      .select("project_id")
      .in("project_id", projectIds);

    if (error) {
      return NextResponse.json({ error: "Failed to fetch endorsements" }, { status: 500 });
    }

    const counts = new Map<string, number>();
    for (const row of (rows ?? []) as { project_id: string }[]) {
      counts.set(row.project_id, (counts.get(row.project_id) ?? 0) + 1);
    }

    // Which of these the caller has already endorsed — one query, not one per
    // project, and only when there is a session to check.
    const endorsed = new Set<string>();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: mine } = await sb
        .from("project_endorsements")
        .select("project_id")
        .in("project_id", projectIds)
        .eq("user_id", user.id);
      for (const row of (mine ?? []) as { project_id: string }[]) {
        endorsed.add(row.project_id);
      }
    }

    // Preserve the original single-project response shape for existing callers.
    if (!batchParam) {
      return NextResponse.json({
        count: counts.get(projectIds[0]) ?? 0,
        user_endorsed: endorsed.has(projectIds[0]),
      });
    }

    return NextResponse.json({
      results: Object.fromEntries(
        projectIds.map((id) => [
          id,
          { count: counts.get(id) ?? 0, user_endorsed: endorsed.has(id) },
        ]),
      ),
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST /api/endorsements — Endorse a project
export async function POST(req: NextRequest) {
  try {
    // Rate-limit is the cheap abuse gate — check it first so throttled traffic
    // never reaches Supabase Auth or the database.
    const { success } = await checkRateLimit(endorsementsLimiter, getIP(req));
    if (!success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

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

    // Every pre-insert check reads independent data, so fire them concurrently
    // instead of one blocking round-trip at a time. The DB unique constraint is
    // the real duplicate guard, so there's no separate pre-SELECT for one.
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [
      { data: project, error: projErr },
      { data: endorserProfile, error: profileErr },
      { count: endorserProjectCount },
      { count: recentEndorsements, error: recentErr },
    ] = await Promise.all([
      sb.from("projects").select("id, user_id").eq("id", project_id).single(),
      sb.from("users").select("created_at, streak, vibe_score").eq("id", user.id).single(),
      sb.from("projects").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      sb
        .from("project_endorsements")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", oneDayAgo),
    ]);

    // Check project exists and user doesn't own it
    if (projErr || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    if (project.user_id === user.id) {
      return NextResponse.json({ error: "You cannot endorse your own project" }, { status: 403 });
    }

    // Fail closed: if we can't read the endorser's profile or their recent
    // endorsement count, deny rather than silently skipping the anti-gaming
    // gates — a dropped error would otherwise bypass the age/activity checks or
    // reset the daily cap to 0.
    if (profileErr || !endorserProfile) {
      return NextResponse.json(
        { error: "Couldn't verify your account, please try again" },
        { status: 503 }
      );
    }
    if (recentErr) {
      return NextResponse.json(
        { error: "Couldn't verify your endorsement limit, please try again" },
        { status: 503 }
      );
    }

    // Anti-gaming: account must be at least 7 days old
    const accountAge = Date.now() - new Date(endorserProfile.created_at).getTime();
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    if (accountAge < SEVEN_DAYS) {
      return NextResponse.json(
        { error: "Your account must be at least 7 days old to endorse projects" },
        { status: 403 }
      );
    }

    // Anti-gaming: endorser needs some activity (1+ projects, a streak, or a score)
    if (
      (endorserProjectCount ?? 0) === 0 &&
      endorserProfile.streak === 0 &&
      endorserProfile.vibe_score === 0
    ) {
      return NextResponse.json(
        { error: "Add a project or log activity before endorsing others" },
        { status: 403 }
      );
    }

    // Anti-gaming: max 10 endorsements per user per day
    if ((recentEndorsements ?? 0) >= 10) {
      return NextResponse.json(
        { error: "You can endorse up to 10 projects per day" },
        { status: 429 }
      );
    }

    // Insert endorsement — the unique constraint is the source of truth for duplicates
    const { error } = await sb
      .from("project_endorsements")
      .insert({ project_id, user_id: user.id });

    const adminSb = createAdminClient();

    if (error) {
      if (error.code === "23505") {
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

    // Invalidate the owner's profile cache (so their +5 vibe_score shows up
    // right away) after the response is sent — keeps the extra read + cache
    // busting off the request path.
    after(() => revalidateOwnerProfile(project.user_id));

    return NextResponse.json({ success: true, count: count || 0 });
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

      // Bust the owner's profile cache after the response is sent — the owner
      // lookup + revalidation don't need to be on the request path.
      after(async () => {
        const { data: project } = await adminSb
          .from("projects")
          .select("user_id")
          .eq("id", project_id)
          .single();

        if (project?.user_id) {
          await revalidateOwnerProfile(project.user_id);
        }
      });

      return NextResponse.json({ success: true, count: count || 0 });
    }
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
