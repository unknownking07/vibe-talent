import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const ALLOWED_NOTIFICATION_TYPES = [
  "streak_warning",
  "badge_earned",
  "project_verified",
  "hire_request",
  "hire_message",
  "endorsement",
  "review",
  "streak_milestone",
  "referral_prompt",
] as const;

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;

    const [{ data, error }, { count }] = await Promise.all([
      sb
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50),
      sb
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("read", false),
    ]);

    if (error) {
      console.error("Failed to fetch notifications:", error);
      return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
    }

    return NextResponse.json({ data: data || [], unread_count: count || 0 });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, mark_all, type } = body;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;

    if (mark_all) {
      const { error } = await sb
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user.id)
        .eq("read", false);

      if (error) {
        console.error("Failed to mark all notifications read:", error);
        return NextResponse.json({ error: "Failed to update" }, { status: 500 });
      }
    } else if (type) {
      if (!ALLOWED_NOTIFICATION_TYPES.includes(type)) {
        return NextResponse.json({ error: "Invalid notification type" }, { status: 400 });
      }
      const { error } = await sb
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user.id)
        .eq("type", type)
        .eq("read", false);

      if (error) {
        console.error("Failed to mark notifications by type read:", error);
        return NextResponse.json({ error: "Failed to update" }, { status: 500 });
      }
    } else if (id) {
      const { error } = await sb
        .from("notifications")
        .update({ read: true })
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) {
        console.error("Failed to mark notification read:", error);
        return NextResponse.json({ error: "Failed to update" }, { status: 500 });
      }
    } else {
      return NextResponse.json({ error: "Provide id, type, or mark_all" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
