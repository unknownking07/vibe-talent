import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const hireRequestId = searchParams.get("hire_request_id");

    if (!hireRequestId) {
      return NextResponse.json(
        { error: "Missing hire_request_id" },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabaseClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;

    // Fetch the hire request to verify it exists
    const { data: hireRequest, error: hrError } = await sb
      .from("hire_requests")
      .select("*")
      .eq("id", hireRequestId)
      .single();

    if (hrError || !hireRequest) {
      return NextResponse.json(
        { error: "Hire request not found" },
        { status: 404 }
      );
    }

    // Fetch all messages for this hire request
    const { data: messages, error: msgError } = await sb
      .from("hire_messages")
      .select("*")
      .eq("hire_request_id", hireRequestId)
      .order("created_at", { ascending: true });

    if (msgError) {
      console.error("Failed to fetch messages:", msgError);
      return NextResponse.json(
        { error: "Failed to fetch messages" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      hire_request: hireRequest,
      messages: messages || [],
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { hire_request_id, sender_type, message } = body;

    if (!hire_request_id || !sender_type || !message) {
      return NextResponse.json(
        { error: "Missing required fields: hire_request_id, sender_type, message" },
        { status: 400 }
      );
    }

    if (!["builder", "client"].includes(sender_type)) {
      return NextResponse.json(
        { error: "sender_type must be 'builder' or 'client'" },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabaseClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;

    // Fetch the hire request
    const { data: hireRequest, error: hrError } = await sb
      .from("hire_requests")
      .select("*")
      .eq("id", hire_request_id)
      .single();

    if (hrError || !hireRequest) {
      return NextResponse.json(
        { error: "Hire request not found" },
        { status: 404 }
      );
    }

    // If sender is builder, verify auth
    if (sender_type === "builder") {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || user.id !== hireRequest.builder_id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    // Insert the message
    const { data: newMessage, error: insertError } = await sb
      .from("hire_messages")
      .insert({
        hire_request_id,
        sender_type,
        message: message.trim(),
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to insert message:", insertError);
      return NextResponse.json(
        { error: "Failed to send message" },
        { status: 500 }
      );
    }

    // If builder is sending the first reply, update the hire request status
    if (sender_type === "builder" && hireRequest.status !== "replied") {
      await sb
        .from("hire_requests")
        .update({
          status: "replied",
          reply: message.trim(),
          replied_at: new Date().toISOString(),
        })
        .eq("id", hire_request_id);
    }

    return NextResponse.json({ data: newMessage });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
