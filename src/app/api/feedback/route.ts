import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const VALID_REASONS = new Set([
  "not_useful", "confusing", "no_time",
  "missing_features", "found_alternative", "other",
]);

const VALID_WOULD_RETURN = new Set(["yes", "maybe", "no"]);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { username, reason, details, would_return, source } = body;

    if (!reason || typeof reason !== "string" || !VALID_REASONS.has(reason)) {
      return NextResponse.json({ error: "Invalid reason" }, { status: 400 });
    }

    if (would_return && !VALID_WOULD_RETURN.has(would_return)) {
      return NextResponse.json({ error: "Invalid would_return value" }, { status: 400 });
    }

    const sb = createAdminClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (sb as any).from("feedback").insert({
      username: typeof username === "string" ? username.slice(0, 100) : null,
      reason,
      details: typeof details === "string" ? details.slice(0, 2000) : null,
      would_return: would_return || null,
      source: typeof source === "string" ? source.slice(0, 50) : "re_engagement_email",
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error("Failed to save feedback:", error);
      return NextResponse.json({ error: "Failed to save feedback" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
