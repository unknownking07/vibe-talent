import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const builder_username =
      typeof body.builder_username === "string"
        ? body.builder_username.trim()
        : body.builder_username;
    const sender_name =
      typeof body.sender_name === "string"
        ? body.sender_name.trim()
        : body.sender_name;
    const sender_email =
      typeof body.sender_email === "string"
        ? body.sender_email.trim()
        : body.sender_email;
    const message =
      typeof body.message === "string"
        ? body.message.trim()
        : body.message;
    const budget =
      typeof body.budget === "string"
        ? body.budget.trim()
        : body.budget;

    if (!builder_username || !sender_name || !sender_email || !message) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: builder_username, sender_name, sender_email, message",
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate max lengths
    if (sender_name.length > 100) {
      return NextResponse.json(
        { error: "sender_name must be 100 characters or fewer" },
        { status: 400, headers: corsHeaders }
      );
    }
    if (sender_email.length > 254) {
      return NextResponse.json(
        { error: "sender_email must be 254 characters or fewer" },
        { status: 400, headers: corsHeaders }
      );
    }
    if (message.length > 2000) {
      return NextResponse.json(
        { error: "message must be 2000 characters or fewer" },
        { status: 400, headers: corsHeaders }
      );
    }
    if (budget && budget.length > 100) {
      return NextResponse.json(
        { error: "budget must be 100 characters or fewer" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(sender_email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400, headers: corsHeaders }
      );
    }

    const supabase = await createServerSupabaseClient();

    // Look up builder by username
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: builder, error: builderError } = await (supabase as any)
      .from("users")
      .select("id, username")
      .eq("username", builder_username)
      .single();

    if (builderError || !builder) {
      return NextResponse.json(
        { error: "Builder not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    // Create hire request
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("hire_requests")
      .insert({
        builder_id: builder.id,
        sender_name,
        sender_email,
        message,
        budget: budget || null,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Failed to create hire request:", error);
      return NextResponse.json(
        { error: "Failed to create hire request" },
        { status: 500, headers: corsHeaders }
      );
    }

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL || "https://vibetalent.xyz";
    const chatUrl = `${siteUrl}/hire/${data.id}/chat`;

    return NextResponse.json(
      {
        success: true,
        id: data.id,
        chat_url: chatUrl,
      },
      { status: 201, headers: corsHeaders }
    );
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400, headers: corsHeaders }
    );
  }
}
