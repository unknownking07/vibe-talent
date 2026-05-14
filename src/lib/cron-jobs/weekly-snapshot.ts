import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Writes one snapshot row per active user for this Monday's week_start.
 * Idempotent: PRIMARY KEY (user_id, week_start) means re-running the same day overwrites
 * via ON CONFLICT.
 */
export async function runWeeklySnapshot(now: Date = new Date()): Promise<{ inserted: number }> {
  const sb = createAdminClient();

  const weekStart = mondayOf(now);
  const weekStartStr = weekStart.toISOString().slice(0, 10);

  // Pull all users with score > 0, ranked.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: users, error } = await (sb as any)
    .from("users")
    .select("id, vibe_score")
    .gt("vibe_score", 0)
    .order("vibe_score", { ascending: false });

  if (error || !users) {
    console.error("weekly-snapshot: fetch failed", error);
    return { inserted: 0 };
  }

  const rows = users.map((u: { id: string; vibe_score: number }, idx: number) => ({
    user_id: u.id,
    week_start: weekStartStr,
    vibe_score: u.vibe_score,
    rank: idx + 1,
    // commits_7d: intentionally left at 0 for v1. Spec §13 defers per-snapshot commit
    // aggregation to post-hackathon. The cards already surface commits_7d from the
    // projects table (Task 24), so the leaderboard receipt doesn't need it yet.
    commits_7d: 0,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insErr, count } = await (sb as any)
    .from("vibe_score_weekly_snapshots")
    .upsert(rows, { onConflict: "user_id,week_start", count: "exact" });

  if (insErr) {
    console.error("weekly-snapshot: upsert failed", insErr);
    return { inserted: 0 };
  }
  return { inserted: count ?? rows.length };
}

/** Returns the Monday on or before `d` at UTC midnight. */
export function mondayOf(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = x.getUTCDay();              // 0=Sun..6=Sat
  const diff = day === 0 ? 6 : day - 1;
  x.setUTCDate(x.getUTCDate() - diff);
  return x;
}
