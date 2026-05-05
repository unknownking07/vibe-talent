/**
 * Force a fresh GitHub sync for every active user without going through
 * the github-sync cron queue. Use when the production cron's ASC ordering
 * by lifetime_contributions keeps timing out before reaching heavy users
 * at the back of the list, leaving them with stale streaks.
 *
 * Usage:
 *   npx tsx scripts/admin/sync-user-streak.ts          # sync everyone
 *   npx tsx scripts/admin/sync-user-streak.ts --dry-run # report-only, no writes
 *
 * What it does for each user with a github_username:
 *   1. Fetch the live GitHub contribution heatmap (public HTML endpoint)
 *   2. Batch-upsert every active date into streak_logs (one round-trip)
 *   3. Update users.lifetime_contributions / contributions_30d
 *   4. Call the update_user_streak() RPC to recompute streak + vibe_score
 *   5. Print before/after streak so you can see who actually moved
 *
 * Iteration order is DESC by lifetime_contributions so heavy users — the
 * ones the production cron starves — get processed first.
 */
import { createClient } from "@supabase/supabase-js";
import { fetchGitHubContributions, sumLastNDays } from "../../src/lib/github-contributions";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env. " +
      "Source .env.local or export them before running."
  );
  process.exit(1);
}

if (!process.env.GITHUB_TOKEN) {
  // fetchGitHubContributions hits github.com HTML and doesn't use the API
  // token, but printing a clear pre-flight warning saves debugging time when
  // a future code path adds events-API calls and silently rate-limits.
  console.warn(
    "[warn] GITHUB_TOKEN not set in env. Anonymous GitHub HTML fetches " +
      "rarely rate-limit at small batch sizes, but if you see 429s or " +
      "0-day skips, export GITHUB_TOKEN (any unscoped GitHub PAT) and retry."
  );
}

const sb = createClient(url, serviceRoleKey);

const RATE_LIMIT_DELAY_MS = 800;

function cleanGithubUsername(raw: string): string {
  return raw
    .replace(/^@/, "")
    .replace(/^https?:\/\/(?:www\.)?github\.com\//, "")
    .replace(/\/+$/, "")
    .trim();
}

interface UserRow {
  id: string;
  username: string;
  github_username: string | null;
  streak: number;
  longest_streak: number;
  vibe_score: number;
  lifetime_contributions: number | null;
}

type SyncResult =
  | {
      kind: "synced";
      user: string;
      before: { streak: number; longest_streak: number; vibe_score: number };
      after: { streak: number; longest_streak: number; vibe_score: number };
      dates_logged: number;
      lifetime: number;
      last30d: number;
    }
  | { kind: "skipped"; user: string; reason: string }
  | { kind: "error"; user: string; reason: string };

async function syncOne(user: UserRow, dryRun: boolean): Promise<SyncResult> {
  let handle = user.github_username;
  if (!handle) {
    // Fall back to social_links.github
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: link } = await (sb as any)
      .from("social_links")
      .select("github")
      .eq("user_id", user.id)
      .single();
    handle = link?.github ?? null;
  }
  if (!handle) {
    return { kind: "skipped", user: user.username, reason: "no github username" };
  }
  const cleaned = cleanGithubUsername(handle);
  if (!cleaned) {
    return { kind: "skipped", user: user.username, reason: "github username unparseable" };
  }

  // 1. Fetch live contributions from GitHub
  const { contributions, total: heatmapTotal } = await fetchGitHubContributions(cleaned);
  const activeDates = Object.entries(contributions).filter(([, c]) => c > 0) as [
    string,
    number
  ][];
  if (activeDates.length === 0) {
    return {
      kind: "skipped",
      user: user.username,
      reason: "GitHub heatmap returned 0 active days",
    };
  }
  const lifetime =
    heatmapTotal > 0 ? heatmapTotal : activeDates.reduce((s, [, c]) => s + c, 0);
  const last30d = sumLastNDays(contributions, 30);

  if (dryRun) {
    return {
      kind: "synced",
      user: user.username,
      before: {
        streak: user.streak,
        longest_streak: user.longest_streak,
        vibe_score: user.vibe_score,
      },
      after: {
        streak: user.streak,
        longest_streak: user.longest_streak,
        vibe_score: user.vibe_score,
      },
      dates_logged: activeDates.length,
      lifetime,
      last30d,
    };
  }

  // 2. Batch upsert streak_logs — single round-trip instead of N. The
  // per-row loop in the production cron is exactly what's timing out for
  // heavy users like meta_alchemist.
  const rows = activeDates.map(([activity_date, commit_count]) => ({
    user_id: user.id,
    activity_date,
    commit_count,
  }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: upsertErr } = await (sb as any)
    .from("streak_logs")
    .upsert(rows, { onConflict: "user_id,activity_date" });
  if (upsertErr) {
    return { kind: "error", user: user.username, reason: `streak_logs upsert: ${upsertErr.message}` };
  }

  // 3. Refresh denormalized totals on users
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateErr } = await (sb as any)
    .from("users")
    .update({ lifetime_contributions: lifetime, contributions_30d: last30d })
    .eq("id", user.id);
  if (updateErr) {
    return { kind: "error", user: user.username, reason: `users update: ${updateErr.message}` };
  }

  // 4. Recompute streak + vibe_score via DB function
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: rpcErr } = await (sb as any).rpc("update_user_streak", {
    p_user_id: user.id,
  });
  if (rpcErr) {
    return { kind: "error", user: user.username, reason: `update_user_streak: ${rpcErr.message}` };
  }

  // 5. Read back so the output reflects what actually changed
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: after } = await (sb as any)
    .from("users")
    .select("streak, longest_streak, vibe_score")
    .eq("id", user.id)
    .single();

  return {
    kind: "synced",
    user: user.username,
    before: {
      streak: user.streak,
      longest_streak: user.longest_streak,
      vibe_score: user.vibe_score,
    },
    after: {
      streak: after?.streak ?? -1,
      longest_streak: after?.longest_streak ?? -1,
      vibe_score: after?.vibe_score ?? -1,
    },
    dates_logged: rows.length,
    lifetime,
    last30d,
  };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  // Pull every user who has a github_username set. Order by
  // lifetime_contributions DESC so the heaviest accounts — the ones whose
  // streaks you actually care about being fresh — go first. The production
  // cron does the opposite (ASC) which is why meta_alchemist's row was stale.
  //
  // PostgREST defaults to a 1,000-row cap on .select() unless you opt into
  // a larger range, which would silently truncate the platform once the
  // user count crosses 1k. Use .range(0, MAX_USERS - 1) so the script
  // genuinely processes every row.
  const MAX_USERS = 100_000;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: users, error } = await (sb as any)
    .from("users")
    .select("id, username, github_username, streak, longest_streak, vibe_score, lifetime_contributions")
    .not("github_username", "is", null)
    .neq("github_username", "")
    .order("lifetime_contributions", { ascending: false, nullsFirst: false })
    .range(0, MAX_USERS - 1);
  if (error) {
    console.error("Failed to fetch users:", error.message);
    process.exit(1);
  }
  if (!users || users.length === 0) {
    console.log("No users with a github_username found.");
    return;
  }
  if (users.length === MAX_USERS) {
    console.warn(
      `[warn] hit MAX_USERS=${MAX_USERS} cap — bump the constant if the platform has grown beyond that.`
    );
  }

  console.log(`\n── Syncing ${users.length} user(s)${dryRun ? " (dry-run, no writes)" : ""} ──\n`);

  let synced = 0;
  let skipped = 0;
  let errored = 0;
  let bumped = 0;
  for (const u of users as UserRow[]) {
    const r = await syncOne(u, dryRun);
    if (r.kind === "error") {
      errored++;
      console.log(`  ✗ ${r.user.padEnd(28)}  ${r.reason}`);
    } else if (r.kind === "skipped") {
      skipped++;
      console.log(`  − ${r.user.padEnd(28)}  skipped (${r.reason})`);
    } else {
      synced++;
      const moved =
        r.after.streak !== r.before.streak || r.after.vibe_score !== r.before.vibe_score;
      if (moved) bumped++;
      console.log(
        `  ${moved ? "✓" : "·"} ${r.user.padEnd(28)}  ` +
          `streak ${r.before.streak}→${r.after.streak}, ` +
          `vibe ${r.before.vibe_score}→${r.after.vibe_score}, ` +
          `${r.dates_logged} dates, lifetime ${r.lifetime}`
      );
    }
    await new Promise((res) => setTimeout(res, RATE_LIMIT_DELAY_MS));
  }

  console.log(
    `\nDone: ${synced} synced (${bumped} actually moved), ${skipped} skipped, ${errored} errored.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
