import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchGitHubContributions, sumLastNDays } from "@/lib/github-contributions";

const QUALIFYING_EVENTS = ["PushEvent", "CreateEvent", "PullRequestEvent", "IssuesEvent"];
const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 2000;

function cleanGithubUsername(raw: string): string {
  return raw
    .replace(/^@/, "")
    .replace(/^https?:\/\/github\.com\//, "")
    .replace(/\/$/, "")
    .trim();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Cron job: Sync GitHub activity for all users with a GitHub username configured.
 * Runs every 6 hours via Vercel Cron.
 *
 * Protected by CRON_SECRET to prevent unauthorized access.
 */
export async function GET(req: NextRequest) {
  // Verify cron secret (skip in development)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = createAdminClient();

  // Build common GitHub API headers. Anonymous calls share Vercel's IP with
  // every other Vercel project and are capped at 60/hr — easy to exhaust
  // partway through the run, leaving most users un-synced. With a token the
  // limit is 5000/hr.
  const githubToken = process.env.GITHUB_TOKEN;
  const ghApiHeaders: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "VibeTalent/1.0",
  };
  if (githubToken) {
    ghApiHeaders.Authorization = `Bearer ${githubToken}`;
  } else {
    console.warn(
      "[github-sync] GITHUB_TOKEN not set — anonymous api.github.com limit " +
      "is 60/hr per IP. Expect partial sync once userbase exceeds ~30 users. " +
      "Add a GitHub PAT (no scopes / public_repo) as GITHUB_TOKEN in Vercel."
    );
  }

  try {
    // Fetch users with github_username set
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: usersWithGithub, error: usersError } = await (supabase as any)
      .from("users")
      .select("id, username, github_username")
      .not("github_username", "is", null)
      .neq("github_username", "");

    if (usersError) {
      console.error("Failed to fetch users:", usersError);
      return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
    }

    // Fetch social_links for users who may have github set there
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: socialLinksData, error: socialError } = await (supabase as any)
      .from("social_links")
      .select("user_id, github")
      .not("github", "is", null)
      .neq("github", "");

    if (socialError) {
      console.error("Failed to fetch social links:", socialError);
      // Non-fatal: continue with users table data
    }

    // Build a map of user_id -> github_username
    const userGithubMap = new Map<string, { userId: string; username: string; githubUsername: string }>();

    // Add users with github_username from users table
    for (const user of usersWithGithub || []) {
      const cleaned = cleanGithubUsername(user.github_username);
      if (cleaned) {
        userGithubMap.set(user.id, {
          userId: user.id,
          username: user.username || user.id,
          githubUsername: cleaned,
        });
      }
    }

    // Add users from social_links who aren't already in the map
    if (socialLinksData) {
      for (const link of socialLinksData) {
        if (!userGithubMap.has(link.user_id)) {
          const cleaned = cleanGithubUsername(link.github);
          if (cleaned) {
            userGithubMap.set(link.user_id, {
              userId: link.user_id,
              username: link.user_id, // We don't have username from social_links
              githubUsername: cleaned,
            });
          }
        }
      }
    }

    const usersToSync = Array.from(userGithubMap.values());

    if (usersToSync.length === 0) {
      return NextResponse.json({
        message: "No users with GitHub usernames found",
        synced: 0,
        skipped: 0,
        errors: 0,
      });
    }

    let synced = 0;
    let skipped = 0;
    let errors = 0;
    const details: { user: string; github: string; status: string; dates_logged?: number; lifetime?: number; last30d?: number; events_api_error?: string }[] = [];

    // Process in batches
    for (let i = 0; i < usersToSync.length; i += BATCH_SIZE) {
      const batch = usersToSync.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.allSettled(
        batch.map(async (userInfo) => {
          try {
            // Try the events API first (for the activity feed). Failure here
            // is NON-fatal — we still fetch the heatmap below for lifetime
            // and 30d totals. Previously a single 403 (rate-limit) on this
            // call would skip a user entirely, so most users never got their
            // volume scoring populated.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let recentEvents: any[] = [];
            let eventsApiError: string | null = null;
            let userNotFound = false;

            try {
              const response = await fetch(
                `https://api.github.com/users/${encodeURIComponent(userInfo.githubUsername)}/events/public?per_page=100`,
                { headers: ghApiHeaders }
              );

              if (response.status === 404) {
                userNotFound = true;
              } else if (!response.ok) {
                eventsApiError = response.status === 403
                  ? "rate limit exceeded"
                  : `HTTP ${response.status}`;
              } else {
                const events = await response.json();
                const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
                recentEvents = events.filter(
                  (event: { type: string; created_at: string }) =>
                    QUALIFYING_EVENTS.includes(event.type) &&
                    new Date(event.created_at) > oneDayAgo
                );
              }
            } catch (err) {
              eventsApiError = err instanceof Error ? err.message : "fetch failed";
            }

            // Hard skip only if GitHub explicitly says the user doesn't exist.
            if (userNotFound) {
              return { userInfo, status: "skipped", reason: "GitHub user not found" };
            }

            // Save events to feed_events table for the activity feed (only
            // when the events API actually succeeded and returned items).
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const feedRows = recentEvents.slice(0, 10).map((event: any) => {
              const repoName = (event.repo?.name || 'unknown').replace(/^[^/]+\//, '');
              let message = '';
              let eventType = 'push';
              let githubUrl = '';

              if (event.type === 'PushEvent') {
                eventType = 'push';
                message = event.payload?.commits?.[0]?.message?.split("\n")[0] || 'pushed code';
                const sha = event.payload?.commits?.[0]?.sha || '';
                githubUrl = sha ? 'https://github.com/' + event.repo?.name + '/commit/' + sha : '';
              } else if (event.type === 'PullRequestEvent') {
                eventType = 'pr';
                message = event.payload?.pull_request?.title || 'opened a pull request';
                githubUrl = event.payload?.pull_request?.html_url || '';
              } else if (event.type === 'CreateEvent') {
                eventType = 'create';
                const refType = event.payload?.ref_type || 'repository';
                message = 'created ' + refType + (event.payload?.ref ? ' ' + event.payload.ref : '');
                githubUrl = 'https://github.com/' + event.repo?.name;
              } else if (event.type === 'IssuesEvent') {
                eventType = 'issue';
                message = event.payload?.issue?.title || 'opened an issue';
                githubUrl = event.payload?.issue?.html_url || '';
              }

              return {
                user_id: userInfo.userId,
                event_type: eventType,
                repo_name: repoName,
                message: message.slice(0, 500),
                github_url: githubUrl,
                created_at: event.created_at,
              };
            });

            if (feedRows.length > 0) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await (supabase as any).from('feed_events').insert(feedRows);
            }

            // Pull the user's full-year contribution heatmap from GitHub for
            // accurate per-day commit counts, lifetime totals, and last-30d
            // activity. Failures here are non-fatal — falls back to the
            // events-API path so streak_logs still updates.
            const { contributions, total: heatmapTotal } = await fetchGitHubContributions(
              userInfo.githubUsername
            );
            const lifetime = heatmapTotal > 0
              ? heatmapTotal
              : Object.values(contributions).reduce((s, v) => s + (v > 0 ? v : 0), 0);
            const last30d = sumLastNDays(contributions, 30);

            // Extract unique activity dates from the events feed (last 24h
            // window) — these are the dates we know had activity even before
            // GitHub's heatmap may have indexed them.
            const eventDates = [
              ...new Set(
                recentEvents.map((event: { created_at: string }) =>
                  new Date(event.created_at).toISOString().split("T")[0]
                )
              ),
            ] as string[];

            // Merge: heatmap dates with count > 0, plus event dates as
            // fallback (count = 1) if not already in heatmap.
            const dateCounts = new Map<string, number>();
            for (const [date, count] of Object.entries(contributions)) {
              if (count > 0) dateCounts.set(date, count);
            }
            for (const d of eventDates) {
              if (!dateCounts.has(d)) dateCounts.set(d, 1);
            }

            // Skip if there's nothing at all to record (no events, empty
            // heatmap) — most likely a private/empty GitHub user.
            if (dateCounts.size === 0 && lifetime === 0) {
              return { userInfo, status: "skipped", reason: "No GitHub activity in last year" };
            }

            // Upsert streak_logs with real per-day counts. Only writes dates
            // that have new data; existing entries past the cron window stay
            // unchanged and continue contributing to the streak calculation.
            let loggedCount = 0;
            for (const [activityDate, count] of dateCounts.entries()) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const { error } = await (supabase as any)
                .from("streak_logs")
                .upsert(
                  { user_id: userInfo.userId, activity_date: activityDate, commit_count: count },
                  { onConflict: "user_id,activity_date" }
                );

              if (!error) loggedCount++;
            }

            // Update denormalized totals on users so update_user_streak can
            // read them when computing the volume bonus.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase as any)
              .from("users")
              .update({ lifetime_contributions: lifetime, contributions_30d: last30d })
              .eq("id", userInfo.userId);

            // Recalculate streak + vibe_score via DB function (handles everything)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error: recalcError } = await (supabase as any).rpc("update_user_streak", {
              p_user_id: userInfo.userId,
            });
            if (recalcError) {
              return {
                userInfo,
                status: "error",
                reason: `Failed to recalculate vibe score: ${recalcError.message}`,
              };
            }

            return { userInfo, status: "synced", loggedCount, lifetime, last30d, eventsApiError };
          } catch (err) {
            console.error(`Error syncing GitHub for ${userInfo.githubUsername}:`, err);
            return { userInfo, status: "error", reason: "Unexpected error" };
          }
        })
      );

      for (const result of batchResults) {
        if (result.status === "fulfilled") {
          const val = result.value;
          if (val.status === "synced") {
            synced++;
            details.push({
              user: val.userInfo.username,
              github: val.userInfo.githubUsername,
              status: "synced",
              dates_logged: val.loggedCount,
              lifetime: val.lifetime,
              last30d: val.last30d,
              ...(val.eventsApiError ? { events_api_error: val.eventsApiError } : {}),
            });
          } else if (val.status === "skipped") {
            skipped++;
            details.push({
              user: val.userInfo.username,
              github: val.userInfo.githubUsername,
              status: `skipped: ${val.reason}`,
            });
          } else {
            errors++;
            details.push({
              user: val.userInfo.username,
              github: val.userInfo.githubUsername,
              status: `error: ${val.reason}`,
            });
          }
        } else {
          errors++;
          details.push({
            user: "unknown",
            github: "unknown",
            status: `error: ${result.reason}`,
          });
        }
      }

      // Delay between batches to respect GitHub rate limits
      if (i + BATCH_SIZE < usersToSync.length) {
        await sleep(BATCH_DELAY_MS);
      }
    }

    console.log(`GitHub sync complete: ${synced} synced, ${skipped} skipped, ${errors} errors`);

    return NextResponse.json({
      message: `GitHub sync complete: ${synced} synced, ${skipped} skipped, ${errors} errors`,
      synced,
      skipped,
      errors,
      details,
    });
  } catch (error) {
    console.error("GitHub sync cron job error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
