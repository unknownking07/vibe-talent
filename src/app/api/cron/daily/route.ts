import { NextRequest, NextResponse } from "next/server";
import { getSiteUrl } from "@/lib/seo";
import { runReviewerCalibration } from "@/lib/cron-jobs/reviewer-calibration";
import { getCloudflareContext } from "@opennextjs/cloudflare";

// Daily orchestrator awaits each child cron sequentially, so its own
// timeout has to be long enough to cover the slowest child plus all
// the others. github-sync alone can run up to 5 min at scale.
export const maxDuration = 300;

/**
 * Fan out to a sibling cron route as its own Worker invocation.
 *
 * On Cloudflare, a plain fetch() to the Worker's own public hostname is an edge
 * loopback that STRIPS the Authorization header, so every child cron 401s — even
 * though this orchestrator authenticates fine (GitHub Actions calls it over real
 * external HTTPS). The WORKER_SELF_REFERENCE service binding dispatches
 * Worker-to-Worker directly, preserving the header. Off Cloudflare (Vercel/local)
 * the binding is absent, so fall back to the public fetch.
 */
async function cronFetch(url: string, init: RequestInit): Promise<Response> {
  try {
    const { env } = getCloudflareContext();
    const self = (env as {
      WORKER_SELF_REFERENCE?: { fetch: (input: string, init?: RequestInit) => Promise<Response> };
    }).WORKER_SELF_REFERENCE;
    if (self) return await self.fetch(url, init);
  } catch {
    // Not running on Cloudflare (or context unavailable) — use the public URL.
  }
  return fetch(url, init);
}

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

  const siteUrl = getSiteUrl();
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
      const res = await cronFetch(`${siteUrl}${job.path}`, { headers });
      const data = await res.json().catch(() => ({}));
      results[job.name] = { status: res.status, data };
    } catch (error) {
      results[job.name] = { status: 500, error: String(error) };
    }
  }

  const summary = Object.entries(results).map(([name, r]: [string, { status: number }]) => `${name}:${r.status}`).join(", ");
  console.log(`Daily cron completed: ${summary}`);

  // Run reviewer calibration in-process after the fan-out so we don't burn
  // another Vercel cron slot. Isolated try/catch: a calibration failure must
  // not mask the orchestrator's primary results.
  let reviewerCalibration: { updated: number; skipped: number } | null = null;
  try {
    reviewerCalibration = await runReviewerCalibration();
  } catch (error) {
    console.error("Daily cron reviewer-calibration error:", error);
  }

  return NextResponse.json({
    message: "Daily cron completed",
    results,
    reviewerCalibration,
    ran_at: new Date().toISOString(),
  });
}
