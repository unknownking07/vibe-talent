import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { computeClientOutcomes } from "@/lib/client-outcomes";

function getSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/**
 * GET /api/builders/[username]/outcomes
 * Returns client outcome metrics for a builder (public).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    const sb = getSb();

    // Look up builder by username
    const { data: user, error: userErr } = await sb
      .from("users")
      .select("id")
      .eq("username", username)
      .single();

    if (userErr || !user) {
      return NextResponse.json({ error: "Builder not found" }, { status: 404 });
    }

    // Fetch hire requests for this builder
    const { data: hireRequests } = await sb
      .from("hire_requests")
      .select("id, sender_email, status, created_at, replied_at")
      .eq("builder_id", user.id);

    // Fetch reviews for this builder
    const { data: reviews } = await sb
      .from("reviews")
      .select("rating, trust_score")
      .eq("builder_id", user.id);

    const outcomes = computeClientOutcomes(
      hireRequests || [],
      reviews || []
    );

    return NextResponse.json(outcomes, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
