import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const BLOCKED_DOMAINS = [
  "mailinator.com", "tempmail.com", "throwaway.email", "guerrillamail.com",
  "sharklasers.com", "grr.la", "guerrillamailblock.com", "yopmail.com",
  "fakeinbox.com", "trashmail.com", "dispostable.com", "maildrop.cc",
  "10minutemail.com", "temp-mail.org", "tempail.com",
];

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
    const nameClean = String(sender_name).trim();
    if (nameClean.length < 2 || !/^[a-zA-Z\s'-]+$/.test(nameClean)) {
      return NextResponse.json({ error: "Invalid name. Use letters only, at least 2 characters." }, { status: 400 });
    }

    const emailClean = String(sender_email).trim().toLowerCase();
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(emailClean)) {
      return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
    }

    const emailDomain = emailClean.split("@")[1];
    if (BLOCKED_DOMAINS.includes(emailDomain)) {
      return NextResponse.json({ error: "Disposable email addresses are not allowed." }, { status: 400 });
    }

    const msgClean = String(message).trim();
    if (msgClean.length < 20) {
      return NextResponse.json({ error: "Message must be at least 20 characters." }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();

    // Rate limit: max 5 hire requests per email per day
    const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: recentRequests } = await (supabase as any)
      .from("hire_requests")
      .select("id")
      .eq("sender_email", emailClean)
      .gte("created_at", oneDayAgo);

    if (recentRequests && recentRequests.length >= 5) {
      return NextResponse.json({ error: "Too many requests. Please try again tomorrow." }, { status: 429 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
