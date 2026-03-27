import { createClient } from "@supabase/supabase-js";
import { createNotification } from "@/lib/notifications";
import { sendVibeScoreMilestoneEmail } from "@/lib/email";

const VIBE_MILESTONES = [25, 50, 100, 200, 500, 1000];

/**
 * Check for vibe score milestones and send notifications.
 */
export async function runMilestoneCheck(): Promise<{ notified: number }> {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get all users with their vibe scores
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: users, error } = await (sb as any)
    .from("users")
    .select("id, username, vibe_score")
    .gt("vibe_score", 0);

  if (error || !users || users.length === 0) {
    return { notified: 0 };
  }

  // Get existing milestone notifications to avoid duplicates
  const userIds = users.map((u: { id: string }) => u.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingMilestones } = await (sb as any)
    .from("notifications")
    .select("user_id, metadata")
    .in("user_id", userIds)
    .eq("type", "vibe_score_milestone");

  // Build a set of "userId:milestone" pairs already notified
  const notifiedSet = new Set<string>();
  for (const n of (existingMilestones || [])) {
    const milestone = (n.metadata as { milestone?: number })?.milestone;
    if (milestone) notifiedSet.add(`${n.user_id}:${milestone}`);
  }

  // Check email preferences
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: prefs } = await (sb as any)
    .from("email_preferences")
    .select("user_id, milestone_alerts")
    .in("user_id", userIds);

  const prefMap = new Map((prefs || []).map((p: { user_id: string; milestone_alerts: boolean }) => [p.user_id, p.milestone_alerts]));

  let notified = 0;

  for (const user of users) {
    // Find the highest milestone this user has crossed
    const crossedMilestones = VIBE_MILESTONES.filter(m => user.vibe_score >= m);

    for (const milestone of crossedMilestones) {
      const key = `${user.id}:${milestone}`;
      if (notifiedSet.has(key)) continue;

      // In-app notification
      await createNotification({
        user_id: user.id,
        type: "vibe_score_milestone",
        title: `${milestone} Vibe Score milestone!`,
        message: `Your vibe score just passed ${milestone}. Keep shipping and building your reputation!`,
        metadata: { milestone, current_score: user.vibe_score },
      });

      // Email
      const wantsEmail = prefMap.get(user.id) !== false;
      if (wantsEmail) {
        const { data: authUser } = await sb.auth.admin.getUserById(user.id);
        if (authUser?.user?.email) {
          await sendVibeScoreMilestoneEmail({
            email: authUser.user.email,
            username: user.username,
            vibeScore: user.vibe_score,
            milestone,
          });
        }
      }

      notified++;
    }
  }

  return { notified };
}
