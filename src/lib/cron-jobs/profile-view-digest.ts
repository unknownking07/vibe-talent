import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications";
import { sendProfileViewDigestEmail } from "@/lib/email";

/**
 * Send profile view digest notifications + emails to users who got views today.
 */
export async function runProfileViewDigest(): Promise<{ notified: number }> {
  const sb = createAdminClient();

  const todayStr = new Date().toISOString().split("T")[0];
  const yesterdayStart = new Date();
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  // Get views from the last 24 hours grouped by viewed user
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: views, error } = await (sb as any)
    .from("profile_views")
    .select("viewed_user_id, viewer_user_id")
    .gte("viewed_at", yesterdayStart.toISOString());

  if (error || !views || views.length === 0) {
    return { notified: 0 };
  }

  // Group by viewed_user_id
  const viewsByUser = new Map<string, { viewerIds: Set<string>; total: number }>();
  for (const v of views) {
    if (!viewsByUser.has(v.viewed_user_id)) {
      viewsByUser.set(v.viewed_user_id, { viewerIds: new Set(), total: 0 });
    }
    const entry = viewsByUser.get(v.viewed_user_id)!;
    entry.total++;
    if (v.viewer_user_id) entry.viewerIds.add(v.viewer_user_id);
  }

  // Check who already got notified today
  const userIds = [...viewsByUser.keys()];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingNotifs } = await (sb as any)
    .from("notifications")
    .select("user_id")
    .in("user_id", userIds)
    .eq("type", "profile_view_summary")
    .gte("created_at", `${todayStr}T00:00:00Z`);

  const alreadyNotified = new Set((existingNotifs || []).map((n: { user_id: string }) => n.user_id));

  // Check email preferences
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: prefs } = await (sb as any)
    .from("email_preferences")
    .select("user_id, profile_view_digest")
    .in("user_id", userIds);

  const prefMap = new Map((prefs || []).map((p: { user_id: string; profile_view_digest: boolean }) => [p.user_id, p.profile_view_digest]));

  let notified = 0;

  for (const [userId, { viewerIds, total }] of viewsByUser) {
    if (alreadyNotified.has(userId)) continue;
    if (total < 1) continue;

    // Get viewer usernames
    let viewerNames: string[] = [];
    if (viewerIds.size > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: viewers } = await (sb as any)
        .from("users")
        .select("username")
        .in("id", [...viewerIds]);
      viewerNames = (viewers || []).map((v: { username: string }) => v.username);
    }

    // In-app notification
    await createNotification({
      user_id: userId,
      type: "profile_view_summary",
      title: `${total} profile view${total !== 1 ? "s" : ""} today`,
      message: viewerNames.length > 0
        ? `${viewerNames.slice(0, 3).map(n => `@${n}`).join(", ")}${total > viewerNames.length ? ` and ${total - viewerNames.length} more` : ""} viewed your profile`
        : `${total} people viewed your profile today`,
      metadata: { view_count: total, viewer_names: viewerNames.slice(0, 5) },
    });

    // Email (if opted in)
    const wantsEmail = prefMap.get(userId) !== false; // default true
    if (wantsEmail) {
      // Get user email from auth
      const { data: authUser } = await sb.auth.admin.getUserById(userId);
      const userEmail = authUser?.user?.email;

      // Get username
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: userData } = await (sb as any)
        .from("users")
        .select("username")
        .eq("id", userId)
        .single();

      if (userEmail && userData) {
        await sendProfileViewDigestEmail({
          email: userEmail,
          username: userData.username,
          viewCount: total,
          viewerNames,
        });
      }
    }

    notified++;
  }

  return { notified };
}
