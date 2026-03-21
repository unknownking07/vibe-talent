import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { messagesLimiter, getIP, checkRateLimit } from "@/lib/rate-limit";

// Use a direct client for reading hire requests (RLS blocks anon reads now)
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function GET(req: NextRequest) {
  const { success } = await checkRateLimit(messagesLimiter, getIP(req));
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const hireRequestId = searchParams.get("hire_request_id");

    if (!hireRequestId) {
      return NextResponse.json(
        { error: "Missing hire_request_id" },
        { status: 400 }
      );
    }

    // Validate UUID format to prevent enumeration
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(hireRequestId)) {
      return NextResponse.json({ error: "Invalid hire_request_id" }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Use service client to read hire request (since RLS now blocks anon reads)
    const sb = getServiceClient();

    // Fetch the hire request
    const { data: hireRequest, error: hrError } = await sb
      .from("hire_requests")
      .select("id, builder_id, sender_name, status")
      .eq("id", hireRequestId)
      .single();

    if (hrError || !hireRequest) {
      return NextResponse.json(
        { error: "Hire request not found" },
        { status: 404 }
      );
    }

    // Authorization: only the builder (authenticated) or the client (via knowing the request ID) can read
    // The request ID itself acts as a token for the client — it's a UUID they received when they submitted
    // But we still restrict what fields are returned for non-builders
    const isBuilder = user && user.id === hireRequest.builder_id;

    // Fetch messages
    const { data: messages, error: msgError } = await sb
      .from("hire_messages")
      .select("id, hire_request_id, sender_type, message, created_at")
      .eq("hire_request_id", hireRequestId)
      .order("created_at", { ascending: true });

    if (msgError) {
      console.error("Failed to fetch messages:", msgError);
      return NextResponse.json(
        { error: "Failed to fetch messages" },
        { status: 500 }
      );
    }

    // Return limited hire_request info (no email/budget for non-builders)
    const safeHireRequest = isBuilder
      ? hireRequest
      : { id: hireRequest.id, sender_name: hireRequest.sender_name, status: hireRequest.status };

    return NextResponse.json({
      hire_request: safeHireRequest,
      messages: messages || [],
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { success } = await checkRateLimit(messagesLimiter, getIP(req));
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429 }
    );
  }

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

    if (typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json({ error: "Message cannot be empty" }, { status: 400 });
    }

    if (message.length > 5000) {
      return NextResponse.json({ error: "Message must be 5000 characters or less" }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const sb = getServiceClient();

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

    // If sender claims to be builder, MUST verify auth
    if (sender_type === "builder") {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || user.id !== hireRequest.builder_id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    // If sender claims to be client, verify they know the hire_request_id
    // The hire_request_id acts as a token — only the original sender has it
    // Also verify the hire request exists and hasn't been deleted
    if (sender_type === "client" && !hireRequest) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Insert the message
    const { data: newMessage, error: insertError } = await sb
      .from("hire_messages")
      .insert({
        hire_request_id,
        sender_type,
        message: message.trim().slice(0, 5000),
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
          reply: message.trim().slice(0, 5000),
          replied_at: new Date().toISOString(),
        })
        .eq("id", hire_request_id);
    }

    return NextResponse.json({ data: newMessage });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
