import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
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
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

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

    // Process in batches of 10 to avoid overwhelming servers
    const BATCH_SIZE = 10;
    for (let i = 0; i < projects.length; i += BATCH_SIZE) {
      const batch = projects.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async (project) => {
          const isOk = await checkLiveUrl(project.live_url!);
          return { id: project.id, live_url_ok: isOk };
        })
      );

      for (const result of results) {
        await supabase
          .from("projects")
          .update({ live_url_ok: result.live_url_ok })
          .eq("id", result.id);

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
    });
  } catch (error) {
    console.error("Live URL check error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
