import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications";

/**
 * One-off / admin-triggered: find projects that have neither a live URL
 * nor a GitHub repo and notify their owners to add one.
 *
 * Safe to re-run: skips users who already have an unread
 * `project_missing_links` notification.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("CRON_SECRET is not configured");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  try {
    // Find projects where both links are missing (null or empty string).
    // Fetch a conservative superset, then filter authoritatively in JS — the
    // projects table is small enough that this is fine for an occasional run.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: bareProjects, error: fetchError } = await (supabase as any)
      .from("projects")
      .select("id, user_id, title, live_url, github_url");

    if (fetchError) {
      console.error("Failed to fetch projects:", fetchError);
      return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
    }

    const projectsMissingBoth = (bareProjects || []).filter(
      (p: { live_url?: string | null; github_url?: string | null }) =>
        (!p.live_url || p.live_url.trim() === "") &&
        (!p.github_url || p.github_url.trim() === "")
    );

    if (projectsMissingBoth.length === 0) {
      return NextResponse.json({ message: "No projects missing both links", notified: 0 });
    }

    // Group by user → list of project titles
    const byUser = new Map<string, string[]>();
    for (const p of projectsMissingBoth as Array<{ user_id: string; title: string | null }>) {
      const list = byUser.get(p.user_id) || [];
      list.push(p.title || "Untitled");
      byUser.set(p.user_id, list);
    }

    const userIds = Array.from(byUser.keys());

    // Skip users who already have an unread notification of this type.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing, error: existingError } = await (supabase as any)
      .from("notifications")
      .select("user_id")
      .in("user_id", userIds)
      .eq("type", "project_missing_links")
      .eq("read", false);

    if (existingError) {
      console.error("Failed to check existing notifications:", existingError);
      return NextResponse.json({ error: "Failed to check existing notifications" }, { status: 500 });
    }

    const alreadyNotified = new Set<string>((existing || []).map((n: { user_id: string }) => n.user_id));
    const usersToNotify = userIds.filter((id) => !alreadyNotified.has(id));

    if (usersToNotify.length === 0) {
      return NextResponse.json({ message: "All affected users already have an unread nudge", notified: 0 });
    }

    const results = await Promise.allSettled(
      usersToNotify.map(async (userId) => {
        const titles = byUser.get(userId) || [];
        const quoted = titles.slice(0, 3).map((t) => `"${t}"`).join(", ");
        const extra = titles.length > 3 ? ` and ${titles.length - 3} more` : "";
        const plural = titles.length === 1 ? "project" : "projects";
        await createNotification({
          user_id: userId,
          type: "project_missing_links",
          title: "Add a link to your project",
          message: `Your ${plural} ${quoted}${extra} ${titles.length === 1 ? "is" : "are"} missing a live URL and a GitHub repo. Add at least one so clients can verify your work.`,
          metadata: { project_count: titles.length },
        });
        return userId;
      })
    );

    const succeeded: string[] = [];
    const failed: string[] = [];
    for (let i = 0; i < results.length; i++) {
      if (results[i].status === "fulfilled") succeeded.push(usersToNotify[i]);
      else {
        console.error("Failed to notify user", usersToNotify[i], (results[i] as PromiseRejectedResult).reason);
        failed.push(usersToNotify[i]);
      }
    }

    return NextResponse.json({
      message: `Notified ${succeeded.length} users`,
      notified: succeeded.length,
      affected_projects: projectsMissingBoth.length,
      ...(failed.length > 0 ? { failed } : {}),
    });
  } catch (error) {
    console.error("missing-project-links cron error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
