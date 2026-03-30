import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeClientOutcomes } from "@/lib/client-outcomes";

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
    const sb = createAdminClient();

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
    const { data: hireRequests, error: hireErr } = await sb
      .from("hire_requests")
      .select("id, sender_email, status, created_at, replied_at")
      .eq("builder_id", user.id);

    if (hireErr) {
      console.error("Failed to fetch hire requests:", hireErr);
      return NextResponse.json({ error: "Failed to fetch outcomes data" }, { status: 500 });
    }

    // Fetch reviews for this builder
    const { data: reviews, error: reviewErr } = await sb
      .from("reviews")
      .select("rating, trust_score")
      .eq("builder_id", user.id);

    if (reviewErr) {
      console.error("Failed to fetch reviews:", reviewErr);
      return NextResponse.json({ error: "Failed to fetch outcomes data" }, { status: 500 });
    }

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
