// scripts/seed-social-visibility.ts
// Usage: npx tsx scripts/seed-social-visibility.ts
//
// Inserts last-Monday snapshot rows for the top N active users, so the weekly
// leaderboard shows climbers immediately without waiting for the next Monday cron tick.
//
// Run from a checkout with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env
// (load .env.local before invoking).
import { createAdminClient } from "../src/lib/supabase/admin";
import { mondayOf } from "../src/lib/cron-jobs/weekly-snapshot";

async function main() {
  const sb = createAdminClient();
  const today = new Date();
  const lastMonday = (() => {
    const d = mondayOf(today);
    d.setUTCDate(d.getUTCDate() - 7);
    return d.toISOString().slice(0, 10);
  })();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: users } = await (sb as any)
    .from("users")
    .select("id, username, vibe_score")
    .gt("vibe_score", 50)
    .order("vibe_score", { ascending: false })
    .limit(8);

  if (!users || users.length < 2) {
    console.error("Need at least 2 users with vibe_score > 50 in DB to seed climber data.");
    process.exit(1);
  }

  // Synthesize "last week" by knocking each user's score down 50-130 points and
  // assigning previous ranks in reverse (so they all show as climbers).
  const rows = (users as Array<{ id: string; username: string; vibe_score: number }>).map((u, i) => ({
    user_id: u.id,
    week_start: lastMonday,
    vibe_score: Math.max(100, u.vibe_score - 50 - i * 10),
    rank: users.length - i,
    commits_7d: 0,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb as any)
    .from("vibe_score_weekly_snapshots")
    .upsert(rows, { onConflict: "user_id,week_start" });

  if (error) {
    console.error("Failed to seed snapshots:", error);
    process.exit(1);
  }

  console.log(`Seeded ${rows.length} snapshot rows for week_start=${lastMonday}.`);
  console.log(`Visit http://localhost:3000/leaderboard — weekly tab should now show climbers.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
