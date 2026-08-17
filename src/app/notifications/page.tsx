import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Notification } from "@/lib/types/database";
import { NotificationsClient } from "./notifications-client";

/**
 * Notifications are per-user and read straight from the request's session, so
 * this page must render per request. (worker.ts already refuses to edge-cache
 * any document carrying an auth cookie, so nothing here can leak across
 * sessions — this is belt-and-braces for the Next.js side.)
 */
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The login page reads `?redirect=` (not `?next=`) to decide where to send
  // the user after sign-in. Redirecting on the server means an unauthenticated
  // visitor never downloads the page JS at all.
  if (!user) redirect("/auth/login?redirect=/notifications");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data } = await sb
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  // The unread count that used to come back with this payload was only ever
  // used by the bell, which polls `?count=1` on its own — so it is not fetched
  // here. That drops one of the two round trips this page used to pay for.
  return <NotificationsClient initialNotifications={(data as Notification[]) ?? []} />;
}
