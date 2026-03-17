import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { builder_id, sender_name, sender_email, message, budget } = body;

    if (!builder_id || !sender_name || !sender_email || !message) {
      return NextResponse.json(
        { error: "Missing required fields: builder_id, sender_name, sender_email, message" },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabaseClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("hire_requests")
      .insert({
        builder_id,
        sender_name,
        sender_email,
        message,
        budget: budget || null,
      });

    if (error) {
      console.error("Failed to insert hire request:", error);
      return NextResponse.json({ error: "Failed to send hire request" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("hire_requests")
      .select("*")
      .eq("builder_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch hire requests:", error);
      return NextResponse.json({ error: "Failed to fetch hire requests" }, { status: 500 });
    }

    return NextResponse.json({ data: data || [] });
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
    const { id, status } = body;

    if (!id || !status || !["read", "replied"].includes(status)) {
      return NextResponse.json(
        { error: "Missing or invalid fields: id, status (read | replied)" },
        { status: 400 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("hire_requests")
      .update({ status })
      .eq("id", id)
      .eq("builder_id", user.id);

    if (error) {
      console.error("Failed to update hire request:", error);
      return NextResponse.json({ error: "Failed to update" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
