import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchGitHubContributions, sumLastNDays } from "@/lib/github-contributions";

// Declared as 300s for Pro but Vercel silently caps Hobby at 60s. The batch
// constants below are tuned to finish the full queue inside the 60s envelope
// — with GITHUB_TOKEN set we get 5000 req/hr, so the 2s inter-batch delay
// inherited from the anonymous-API days is no longer needed. A wall-clock
// budget guards against pathological slow users (8s events timeout × N).
export const maxDuration = 300;

const QUALIFYING_EVENTS = ["PushEvent", "CreateEvent", "PullRequestEvent", "IssuesEvent"];
const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 0;
const EVENTS_API_TIMEOUT_MS = 8000;
const WALL_CLOCK_BUDGET_MS = 50_000;

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
    // Fetch users with github_username set. Order by lifetime_contributions
    // DESC NULLS LAST so the platform's heavy users — the ones whose
    // streaks visibly drive the leaderboard / featured grid — get synced
    // first. The previous ASC ordering meant if the function timed out
    // partway through, the back of the queue (heavy users) was the first
    // thing dropped, leaving them stuck for days.
    //
    // github_id is also selected so the rename-detection logic below can
    // verify the username we have on file still points at the same GitHub
    // account (catches handle reclaims after a rename).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: usersWithGithub, error: usersError } = await (supabase as any)
      .from("users")
      .select("id, username, github_username, github_id, lifetime_contributions")
      .not("github_username", "is", null)
      .neq("github_username", "")
      .order("lifetime_contributions", { ascending: false, nullsFirst: false });

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
    const userGithubMap = new Map<
      string,
      { userId: string; username: string; githubUsername: string; githubId: number | null }
    >();

    // Add users with github_username from users table
    for (const user of usersWithGithub || []) {
      const cleaned = cleanGithubUsername(user.github_username);
      if (cleaned) {
        userGithubMap.set(user.id, {
          userId: user.id,
          username: user.username || user.id,
          githubUsername: cleaned,
          githubId: typeof user.github_id === "number" ? user.github_id : null,
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
              githubId: null,
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
    let unattempted = 0;
    const details: { user: string; github: string; status: string; dates_logged?: number; lifetime?: number; last30d?: number; events_api_error?: string }[] = [];
    const loopStart = Date.now();

    // Process in batches
    for (let i = 0; i < usersToSync.length; i += BATCH_SIZE) {
      // Stop cleanly if we're approaching the function timeout. Without this
      // guard the platform kills the function mid-batch and any writes still
      // in flight are lost. Better to return what we have and let the next
      // run pick up the tail.
      if (Date.now() - loopStart > WALL_CLOCK_BUDGET_MS) {
        unattempted = usersToSync.length - i;
        console.warn(
          `[github-sync] wall-clock budget hit after ${i}/${usersToSync.length} users — ${unattempted} unattempted`
        );
        break;
      }

      const batch = usersToSync.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.allSettled(
        batch.map(async (userInfo) => {
          try {
            // Step 1: resolve the canonical GitHub identity via /users/{name}.
            //
            // Previously we tried to detect renames from events[0].actor.login
            // on the events fetch, but that only fires when the user has
            // recent public events AND GitHub's events redirect actually
            // surfaces them — a user could rename and stay invisible to us
            // until they generated activity on the new handle, OR if their
            // old handle was reclaimed by someone else (404 path), we'd
            // hard-skip and never recover.
            //
            // /users/{name} is reliable: it follows renames via stable
            // numeric ID, always returns the canonical login + id, and
            // 404s only on real deletion. Costs +1 API call per user per
            // run — with GITHUB_TOKEN's 5000/hr ceiling, irrelevant.
            let userNotFound = false;
            let userInfoApiError: string | null = null;
            let reclaimDetected = false;

            const userInfoController = new AbortController();
            const userInfoTimeoutId = setTimeout(
              () => userInfoController.abort(),
              EVENTS_API_TIMEOUT_MS
            );
            try {
              const response = await fetch(
                `https://api.github.com/users/${encodeURIComponent(userInfo.githubUsername)}`,
                { headers: ghApiHeaders, signal: userInfoController.signal }
              );

              if (response.status === 404) {
                userNotFound = true;
              } else if (!response.ok) {
                userInfoApiError = response.status === 403
                  ? "rate limit exceeded"
                  : `HTTP ${response.status}`;
              } else {
                const body = await response.json();
                const apiLogin: string | undefined =
                  typeof body?.login === "string" ? body.login : undefined;
                const apiId: number | undefined =
                  typeof body?.id === "number" ? body.id : undefined;

                // Reclaim guard: if we have a github_id on file and the
                // username's current owner has a *different* id, somebody
                // took the old handle after our user renamed away. Bail
                // out — we'd otherwise pull a stranger's commits into our
                // user's feed. Admin can manually re-link with the new
                // handle.
                if (
                  userInfo.githubId !== null &&
                  typeof apiId === "number" &&
                  apiId !== userInfo.githubId
                ) {
                  reclaimDetected = true;
                  console.warn(
                    `[github-sync] handle reclaim suspected for user ${userInfo.userId}: ` +
                    `stored github_id=${userInfo.githubId}, "${userInfo.githubUsername}" now owned by id=${apiId}`
                  );
                } else {
                  // Apply rename and/or backfill github_id from the response.
                  const dbUpdates: Record<string, string | number> = {};
                  const loginChanged =
                    apiLogin &&
                    apiLogin.toLowerCase() !== userInfo.githubUsername.toLowerCase();

                  if (loginChanged) {
                    console.log(
                      `[github-sync] username rename for user ${userInfo.userId}: ` +
                      `stored="${userInfo.githubUsername}" → canonical="${apiLogin}"`
                    );
                    dbUpdates.github_username = apiLogin!;
                  }
                  if (typeof apiId === "number" && userInfo.githubId === null) {
                    dbUpdates.github_id = apiId;
                  }

                  if (Object.keys(dbUpdates).length > 0) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    await (supabase as any)
                      .from("users")
                      .update(dbUpdates)
                      .eq("id", userInfo.userId);
                  }
                  if (loginChanged) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    await (supabase as any)
                      .from("social_links")
                      .upsert(
                        { user_id: userInfo.userId, github: apiLogin! },
                        { onConflict: "user_id" }
                      );
                    // Use the canonical handle for the rest of this iteration.
                    userInfo.githubUsername = apiLogin!;
                  }
                  if (typeof apiId === "number") {
                    userInfo.githubId = apiId;
                  }
                }
              }
            } catch (err) {
              userInfoApiError = err instanceof Error && err.name === "AbortError"
                ? `timeout after ${EVENTS_API_TIMEOUT_MS}ms`
                : err instanceof Error
                  ? err.message
                  : "fetch failed";
            } finally {
              clearTimeout(userInfoTimeoutId);
            }

            if (userNotFound) {
              return { userInfo, status: "skipped", reason: "GitHub user not found" };
            }
            if (reclaimDetected) {
              return {
                userInfo,
                status: "skipped",
                reason: "GitHub handle reclaimed by another account (github_id mismatch)",
              };
            }
            // If user-info failed (rate limit / timeout / transient), fall
            // through and try events with the stored handle anyway — the
            // events redirect will still pick up activity in the common
            // case. We just lose the rename-detection upside for this run.

            // Step 2: events feed for the (now canonical) handle. Failure
            // here is NON-fatal — we still fetch the heatmap below for
            // lifetime and 30d totals. Previously a single 403 (rate-limit)
            // on this call would skip a user entirely, so most users never
            // got their volume scoring populated.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let recentEvents: any[] = [];
            let eventsApiError: string | null = userInfoApiError;

            const eventsController = new AbortController();
            const eventsTimeoutId = setTimeout(
              () => eventsController.abort(),
              EVENTS_API_TIMEOUT_MS
            );
            try {
              const response = await fetch(
                `https://api.github.com/users/${encodeURIComponent(userInfo.githubUsername)}/events/public?per_page=100`,
                { headers: ghApiHeaders, signal: eventsController.signal }
              );

              if (!response.ok) {
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
              eventsApiError = err instanceof Error && err.name === "AbortError"
                ? `timeout after ${EVENTS_API_TIMEOUT_MS}ms`
                : err instanceof Error
                  ? err.message
                  : "fetch failed";
            } finally {
              clearTimeout(eventsTimeoutId);
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

            // Upsert streak_logs with real per-day counts in a single batch
            // round-trip. The previous per-row loop fired N sequential
            // requests (200+ for heavy users), which routinely blew the
            // 5-min serverless budget and starved the back of the queue.
            const streakRows = Array.from(dateCounts.entries()).map(
              ([activity_date, commit_count]) => ({
                user_id: userInfo.userId,
                activity_date,
                commit_count,
              })
            );
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error: streakUpsertError } = await (supabase as any)
              .from("streak_logs")
              .upsert(streakRows, { onConflict: "user_id,activity_date" });
            if (streakUpsertError) {
              // Bail out: running update_user_streak against stale streak_logs
              // would either return the existing (incorrect) streak or compute
              // from partial data. Better to surface the failure to the cron
              // summary so the next run retries cleanly.
              console.error(
                `streak_logs batch upsert failed for ${userInfo.githubUsername}:`,
                streakUpsertError
              );
              return {
                userInfo,
                status: "error",
                reason: `streak_logs upsert failed: ${streakUpsertError.message}`,
              };
            }
            const loggedCount = streakRows.length;

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

      // Delay between batches to respect GitHub rate limits. Set to 0 once
      // GITHUB_TOKEN is in place since the 5000/hr ceiling is far above what
      // this loop generates — kept as a tunable for future no-token rollback.
      if (BATCH_DELAY_MS > 0 && i + BATCH_SIZE < usersToSync.length) {
        await sleep(BATCH_DELAY_MS);
      }
    }

    const budgetNote = unattempted > 0 ? `, ${unattempted} unattempted (budget)` : "";
    console.log(`GitHub sync complete: ${synced} synced, ${skipped} skipped, ${errors} errors${budgetNote}`);

    return NextResponse.json({
      message: `GitHub sync complete: ${synced} synced, ${skipped} skipped, ${errors} errors${budgetNote}`,
      synced,
      skipped,
      errors,
      unattempted,
      details,
    });
  } catch (error) {
    console.error("GitHub sync cron job error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
