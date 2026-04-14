import { NextRequest, NextResponse } from "next/server";

/**
 * Daily orchestrator cron — fans out to individual cron job routes.
 * Each job runs in its own serverless invocation for independent timeouts.
 * Runs daily at 6 AM UTC.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.vibetalent.work";
  const headers = { authorization: `Bearer ${cronSecret}` };

  const jobs = [
    { name: "github-sync", path: "/api/cron/github-sync" },
    { name: "reset-streaks", path: "/api/cron/reset-streaks" },
    { name: "reset-freezes", path: "/api/cron/reset-freezes" },
    { name: "streak-warning", path: "/api/cron/streak-warning" },
    { name: "profile-view-digest", path: "/api/cron/profile-view-digest" },
    { name: "milestone-check", path: "/api/cron/milestone-check" },
    { name: "weekly-digest", path: "/api/cron/weekly-digest" },
    { name: "re-engagement", path: "/api/cron/re-engagement" },
  ];

  const results: Record<string, { status: number; data?: unknown; error?: string }> = {};

  // Run jobs sequentially to be predictable
  for (const job of jobs) {
    try {
      const res = await fetch(`${siteUrl}${job.path}`, { headers });
      const data = await res.json().catch(() => ({}));
      results[job.name] = { status: res.status, data };
    } catch (error) {
      results[job.name] = { status: 500, error: String(error) };
    }
  }

  const summary = Object.entries(results).map(([name, r]: [string, { status: number }]) => `${name}:${r.status}`).join(", ");
  console.log(`Daily cron completed: ${summary}`);

  return NextResponse.json({
    message: "Daily cron completed",
    results,
    ran_at: new Date().toISOString(),
  });
}
