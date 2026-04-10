import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
    const details: { user: string; github: string; status: string; dates_logged?: number }[] = [];

    // Process in batches
    for (let i = 0; i < usersToSync.length; i += BATCH_SIZE) {
      const batch = usersToSync.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.allSettled(
        batch.map(async (userInfo) => {
          try {
            // Fetch public events from GitHub API
            const response = await fetch(
              `https://api.github.com/users/${encodeURIComponent(userInfo.githubUsername)}/events/public?per_page=100`,
              {
                headers: {
                  Accept: "application/vnd.github.v3+json",
                  "User-Agent": "VibeTalent/1.0",
                },
              }
            );

            if (!response.ok) {
              if (response.status === 404) {
                return { userInfo, status: "skipped", reason: "GitHub user not found" };
              }
              if (response.status === 403) {
                return { userInfo, status: "error", reason: "GitHub rate limit exceeded" };
              }
              return { userInfo, status: "error", reason: `GitHub API error: ${response.status}` };
            }

            const events = await response.json();

            // Filter qualifying events from the last 24 hours
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const recentEvents = events.filter(
              (event: { type: string; created_at: string }) =>
                QUALIFYING_EVENTS.includes(event.type) &&
                new Date(event.created_at) > oneDayAgo
            );

            if (recentEvents.length === 0) {
              return { userInfo, status: "skipped", reason: "No recent qualifying events" };
            }

            // Save events to feed_events table for the activity feed
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

            // Extract unique activity dates
            const activityDates = [
              ...new Set(
                recentEvents.map((event: { created_at: string }) =>
                  new Date(event.created_at).toISOString().split("T")[0]
                )
              ),
            ] as string[];

            // Upsert streak_logs for each activity date
            let loggedCount = 0;
            for (const activityDate of activityDates) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const { error } = await (supabase as any)
                .from("streak_logs")
                .upsert(
                  { user_id: userInfo.userId, activity_date: activityDate },
                  { onConflict: "user_id,activity_date" }
                );

              if (!error) loggedCount++;
            }

            // Recalculate streak + vibe_score via DB function (handles everything)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase as any).rpc("update_user_streak", { p_user_id: userInfo.userId });

            return { userInfo, status: "synced", loggedCount };
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
