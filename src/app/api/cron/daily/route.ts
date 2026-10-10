import { NextRequest, NextResponse } from "next/server";
import { getSiteUrl } from "@/lib/seo";
import { runReviewerCalibration } from "@/lib/cron-jobs/reviewer-calibration";
import { getCloudflareContext } from "@opennextjs/cloudflare";

// 90s for GitHub sync + 7 × 60s siblings + 30s calibration = 540s,
// below the external scheduler's 600s request deadline.
export const maxDuration = 600;

async function boundedJob<T>(name: string, timeoutMs: number, work: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(`${name} timed out after ${timeoutMs}ms`);
      controller.abort(error);
      reject(error);
    }, timeoutMs);
  });
  try {
    // The race also bounds service bindings that do not honor AbortSignal.
    return await Promise.race([work(controller.signal), timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

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
  let self: { fetch: (input: string, init?: RequestInit) => Promise<Response> } | undefined;
  try {
    const { env } = getCloudflareContext();
    self = (env as {
      WORKER_SELF_REFERENCE?: { fetch: (input: string, init?: RequestInit) => Promise<Response> };
    }).WORKER_SELF_REFERENCE;
  } catch {
    // Not running on Cloudflare (or context unavailable) — use the public URL.
  }
  // A failed binding request may already have run the job. Do not execute it
  // a second time via public fetch (which also strips auth on Cloudflare).
  return self ? self.fetch(url, init) : fetch(url, init);
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
      results[job.name] = await boundedJob(job.name, job.name === "github-sync" ? 90_000 : 60_000, async (signal) => {
        const res = await cronFetch(`${siteUrl}${job.path}`, { headers, signal });
        const data = await res.json();
        const partialFailure = data && typeof data === "object" &&
          (Boolean(data.error) || (typeof data.errors === "number" && data.errors > 0));
        return { status: res.ok && partialFailure ? 503 : res.status, data };
      });
    } catch (error) {
      results[job.name] = { status: 500, error: String(error) };
    }
  }

  const summary = Object.entries(results).map(([name, r]: [string, { status: number }]) => `${name}:${r.status}`).join(", ");
  console.log(`Daily cron completed: ${summary}`);

  const failedJobs = Object.keys(results).filter(name => results[name].status >= 400);

  // Keep calibration failure visible without losing the sibling results.
  let reviewerCalibration: { updated: number; skipped: number } | null = null;
  try {
    reviewerCalibration = await boundedJob("reviewer-calibration", 30_000, () => runReviewerCalibration());
  } catch (error) {
    console.error("Daily cron reviewer-calibration error:", error);
    failedJobs.push("reviewer-calibration");
  }

  return NextResponse.json({
    message: failedJobs.length ? "Daily cron completed with failures" : "Daily cron completed",
    failed_jobs: failedJobs,
    results,
    reviewerCalibration,
    ran_at: new Date().toISOString(),
  }, { status: failedJobs.length ? 503 : 200 });
}
