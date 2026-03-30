import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const sb = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (sb as any)
      .from("email_preferences")
      .select("*")
      .eq("user_id", user.id)
      .single();

    // Return defaults if no preferences set
    return NextResponse.json(data || {
      profile_view_digest: true,
      streak_reminders: true,
      milestone_alerts: true,
      weekly_digest: true,
      hire_notifications: true,
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const sb = createAdminClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (sb as any)
      .from("email_preferences")
      .upsert({
        user_id: user.id,
        profile_view_digest: body.profile_view_digest ?? true,
        streak_reminders: body.streak_reminders ?? true,
        milestone_alerts: body.milestone_alerts ?? true,
        weekly_digest: body.weekly_digest ?? true,
        hire_notifications: body.hire_notifications ?? true,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      console.error("Failed to update email preferences:", error);
      return NextResponse.json({ error: "Failed to save" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
