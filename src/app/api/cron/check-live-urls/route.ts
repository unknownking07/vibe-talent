import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkLiveUrl } from "@/lib/github-quality";

/**
 * Cron job: Check live URLs for all verified projects.
 * Marks projects as live_url_ok = true/false.
 * Run weekly via Vercel Cron or external scheduler.
 *
 * Protected by CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  // Fail closed in production: a missing CRON_SECRET must never leave this
  // route open to anonymous callers — it performs privileged batch mutations.
  if (!cronSecret && process.env.NODE_ENV === "production") {
    console.error("CRON_SECRET is not configured");
    return NextResponse.json({ error: "Cron secret not configured" }, { status: 500 });
  }
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = createAdminClient();

  try {
    // Fetch all verified projects with a live_url
    const { data: projects, error } = await supabase
      .from("projects")
      .select("id, live_url")
      .eq("verified", true)
      .eq("flagged", false)
      .not("live_url", "is", null);

    if (error || !projects) {
      return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
    }

    let checked = 0;
    let alive = 0;
    let dead = 0;
    let errors = 0;

    // Process in batches of 10 to avoid overwhelming servers
    const BATCH_SIZE = 10;
    for (let i = 0; i < projects.length; i += BATCH_SIZE) {
      const batch = projects.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async (project) => {
          const isOk = await checkLiveUrl(project.live_url!);
          return { id: project.id, live_url: project.live_url!, live_url_ok: isOk };
        })
      );

      for (const result of results) {
        const { data: saved, error: updateErr } = await supabase
          .from("projects")
          .update({ live_url_ok: result.live_url_ok })
          .eq("id", result.id)
          .eq("live_url", result.live_url)
          .select("id")
          .maybeSingle();

        if (updateErr) {
          console.error(`Failed to update project ${result.id}:`, updateErr);
          errors++;
          continue;
        }

        if (!saved) continue; // The demo changed during the check.
        checked++;
        if (result.live_url_ok) alive++;
        else dead++;
      }
    }

    return NextResponse.json({
      message: `Checked ${checked} live URLs`,
      checked,
      alive,
      dead,
      errors,
    }, { status: errors ? 503 : 200 });
  } catch (error) {
    console.error("Live URL check error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
