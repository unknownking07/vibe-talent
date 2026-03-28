import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createHash } from "crypto";

function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/**
 * POST — Track a profile view. Fire-and-forget from client.
 */
export async function POST(req: NextRequest) {
  try {
    const { viewed_user_id } = await req.json();
    if (!viewed_user_id) {
      return NextResponse.json({ error: "Missing viewed_user_id" }, { status: 400 });
    }

    const sb = getServiceClient();

    // Get current user if logged in
    let viewerUserId: string | null = null;
    try {
      const supabase = await createServerSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      viewerUserId = user?.id || null;
    } catch {
      // Not logged in
    }

    // Don't track self-views
    if (viewerUserId && viewerUserId === viewed_user_id) {
      return NextResponse.json({ ok: true, skipped: "self-view" });
    }

    // Hash IP for anonymous dedup
    let viewerIpHash: string | null = null;
    if (!viewerUserId) {
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
      viewerIpHash = hashIp(ip);
    }

    // Insert — the unique index will reject duplicates (same viewer, same profile, same day)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb as any).from("profile_views").insert({
      viewed_user_id,
      viewer_user_id: viewerUserId,
      viewer_ip_hash: viewerIpHash,
      viewed_at: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Profile view tracking error:", error);
    return NextResponse.json({ ok: true }); // Don't fail the client
  }
}

/**
 * GET — Get profile views for the logged-in user (dashboard widget).
 */
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sb = getServiceClient();
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Get views this week
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: weekViews, error } = await (sb as any)
      .from("profile_views")
      .select("id, viewer_user_id, viewed_at")
      .eq("viewed_user_id", user.id)
      .gte("viewed_at", weekAgo)
      .order("viewed_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch profile views:", error);
      return NextResponse.json({ views_today: 0, views_this_week: 0, viewers: [] });
    }

    const views = weekViews || [];
    const viewsToday = views.filter((v: { viewed_at: string }) => v.viewed_at.startsWith(todayStr)).length;

    // Get viewer details for logged-in viewers
    const viewerIds = [...new Set(views.map((v: { viewer_user_id: string | null }) => v.viewer_user_id).filter(Boolean))];

    let viewers: { username: string; avatar_url: string | null; viewed_at: string }[] = [];
    if (viewerIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: viewerData } = await (sb as any)
        .from("users")
        .select("id, username, avatar_url")
        .in("id", viewerIds);

      if (viewerData) {
        const viewerMap = new Map(viewerData.map((u: { id: string; username: string; avatar_url: string | null }) => [u.id, u]));
        viewers = views
          .filter((v: { viewer_user_id: string | null }) => v.viewer_user_id)
          .map((v: { viewer_user_id: string; viewed_at: string }) => {
            const viewer = viewerMap.get(v.viewer_user_id) as { username: string; avatar_url: string | null } | undefined;
            return viewer ? { username: viewer.username, avatar_url: viewer.avatar_url, viewed_at: v.viewed_at } : null;
          })
          .filter(Boolean)
          // Deduplicate by username, keep most recent
          .filter((v: { username: string }, i: number, arr: { username: string }[]) => arr.findIndex(a => a.username === v.username) === i)
          .slice(0, 10);
      }
    }

    const anonymousCount = views.filter((v: { viewer_user_id: string | null }) => !v.viewer_user_id).length;

    return NextResponse.json({
      views_today: viewsToday,
      views_this_week: views.length,
      viewers,
      anonymous_count: anonymousCount,
    });
  } catch (error) {
    console.error("Failed to fetch profile views:", error);
    return NextResponse.json({ views_today: 0, views_this_week: 0, viewers: [], anonymous_count: 0 });
  }
}
