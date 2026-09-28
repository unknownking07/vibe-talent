import { createAdminClient } from "@/lib/supabase/admin";

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

/** Count recorded activity days; restored/frozen streak days are excluded. */
export async function fetchActivityDays(userId: string, start?: string, end?: string): Promise<number> {
  // Streak logs are owner-readable under RLS. The public image exposes only
  // this aggregate for an already-public profile, never individual logs.
  let query = createAdminClient().from("streak_logs")
    .select("activity_date", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("source", "activity");
  if (start) query = query.gte("activity_date", start);
  if (end) query = query.lt("activity_date", end);
  const { count, error } = await query;
  if (error || typeof count !== "number") throw new Error(`Failed to load public activity: ${error?.message ?? "count unavailable"}`);
  return count;
}

export function rollingWindow(days: 7 | 30, now = new Date()): { start: string; end: string } {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return {
    start: new Date(today - (days - 1) * DAY_MS).toISOString().slice(0, 10),
    end: new Date(today + DAY_MS).toISOString().slice(0, 10),
  };
}
