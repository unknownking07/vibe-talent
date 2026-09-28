import { createClient } from "@supabase/supabase-js";

const DAY_MS = 24 * 60 * 60 * 1000;

/** The date in a weekly share URL is the Monday the digest was sent. */
export function weeklyWindow(raw: string): { start: string; end: string; label: string } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const endDate = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(endDate.getTime()) || endDate.toISOString().slice(0, 10) !== raw || endDate.getUTCDay() !== 1) return null;
  const startDate = new Date(endDate.getTime() - 7 * DAY_MS);
  const label = `${startDate.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })} — ${new Date(endDate.getTime() - DAY_MS).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`;
  return { start: startDate.toISOString().slice(0, 10), end: raw, label };
}

/** Public GitHub activity only; restored/frozen streak days are excluded. */
export async function fetchPublicActivity(userId: string, start?: string, end?: string): Promise<{ days: number; commits: number }> {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  let query = sb.from("streak_logs")
    .select("activity_date, commit_count", { count: "exact" })
    .eq("user_id", userId)
    .eq("source", "activity");
  if (start) query = query.gte("activity_date", start);
  if (end) query = query.lt("activity_date", end);
  const { data, count, error } = await query;
  if (error || typeof count !== "number") throw new Error(`Failed to load public activity: ${error?.message ?? "count unavailable"}`);
  return {
    days: count,
    // Weekly windows hold at most seven rows. For larger ranges the card uses
    // the exact day count and does not print this potentially paginated sum.
    commits: (data ?? []).reduce((total, row) => total + (row.commit_count ?? 0), 0),
  };
}
