import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendHireNotification } from "@/lib/email";
import { createNotification } from "@/lib/notifications";
import { validateName, validateEmail } from "@/lib/validation";

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

    // Server-side validation
    const nameResult = validateName(sender_name);
    if (!nameResult.valid) {
      return NextResponse.json({ error: nameResult.error }, { status: 400 });
    }
    const nameClean = nameResult.cleaned;

    const emailResult = validateEmail(sender_email);
    if (!emailResult.valid) {
      return NextResponse.json({ error: emailResult.error }, { status: 400 });
    }
    const emailClean = emailResult.cleaned;

    const msgClean = String(message).trim();
    if (msgClean.length < 20) {
      return NextResponse.json({ error: "Message must be at least 20 characters." }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // Rate limit: max 5 hire requests per email per day
    const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
    const { data: recentRequests } = await adminClient
      .from("hire_requests")
      .select("id")
      .eq("sender_email", emailClean)
      .gte("created_at", oneDayAgo);

    if (recentRequests && recentRequests.length >= 5) {
      return NextResponse.json({ error: "Too many requests. Please try again tomorrow." }, { status: 429 });
    }

    const { data, error } = await adminClient
      .from("hire_requests")
      .insert({
        builder_id,
        sender_name: nameClean,
        sender_email: emailClean,
        message: msgClean,
        budget: budget || null,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Failed to insert hire request:", error);
      return NextResponse.json({ error: "Failed to send hire request" }, { status: 500 });
    }

    // Fire-and-forget: create in-app notification
    createNotification({
      user_id: builder_id,
      type: "hire_request",
      title: "New hire request",
      message: `${nameClean} wants to hire you`,
      metadata: { hire_request_id: data.id, sender_name: nameClean },
    }).catch(console.error);

    // Fire-and-forget: send email notification to builder
    const serviceClient = createAdminClient();
    serviceClient.auth.admin.getUserById(builder_id).then(({ data: userData }) => {
      const builderEmail = userData?.user?.email;
      if (!builderEmail) return;
      // Look up the builder's username
      serviceClient
        .from("users")
        .select("username")
        .eq("id", builder_id)
        .single()
        .then(({ data: builderData }) => {
          sendHireNotification({
            builderEmail,
            builderUsername: builderData?.username || "builder",
            senderName: nameClean,
            message: msgClean,
            requestId: data.id,
          }).catch(console.error);
        });
    }).catch(console.error);

    return NextResponse.json({ success: true, id: data.id });
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
    const { id, status, reply } = body;

    if (!id || !status || !["read", "replied"].includes(status)) {
      return NextResponse.json(
        { error: "Missing or invalid fields: id, status (read | replied)" },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = { status };
    if (status === "replied" && reply) {
      updateData.reply = reply;
      updateData.replied_at = new Date().toISOString();
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("hire_requests")
      .update(updateData)
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

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing request id" }, { status: 400 });
    }

    // Delete associated messages first
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("hire_messages")
      .delete()
      .eq("hire_request_id", id);

    // Delete the hire request (only if it belongs to this builder)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("hire_requests")
      .delete()
      .eq("id", id)
      .eq("builder_id", user.id);

    if (error) {
      console.error("Failed to delete hire request:", error);
      return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
