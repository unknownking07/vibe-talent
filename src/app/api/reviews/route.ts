import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { reviewLimiter, getIP, checkRateLimit } from "@/lib/rate-limit";
import { calculateReviewTrust } from "@/lib/review-trust";

const BLOCKED_DOMAINS = [
  "mailinator.com", "tempmail.com", "throwaway.email", "guerrillamail.com",
  "sharklasers.com", "grr.la", "guerrillamailblock.com", "yopmail.com",
  "fakeinbox.com", "trashmail.com", "dispostable.com", "maildrop.cc",
  "10minutemail.com", "temp-mail.org", "tempail.com",
];

function getSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const builderId = searchParams.get("builder_id");

    if (!builderId) {
      return NextResponse.json({ error: "builder_id is required" }, { status: 400 });
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(builderId)) {
      return NextResponse.json({ error: "Invalid builder_id" }, { status: 400 });
    }

    const sb = getSb();
    const { data, error } = await sb
      .from("reviews")
      .select("id, builder_id, reviewer_name, rating, comment, trust_score, created_at")
      .eq("builder_id", builderId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch reviews:", error);
      return NextResponse.json({ error: "Failed to fetch reviews" }, { status: 500 });
    }

    const reviews = data || [];

    // Only count trusted reviews (trust_score >= 30) for the average rating
    const trustedReviews = reviews.filter((r: { trust_score?: number }) => (r.trust_score ?? 100) >= 30);
    const avgRating = trustedReviews.length > 0
      ? Math.round((trustedReviews.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / trustedReviews.length) * 10) / 10
      : 0;

    return NextResponse.json({
      reviews,
      average_rating: avgRating,
      total_reviews: reviews.length,
      trusted_reviews: trustedReviews.length,
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { success } = await checkRateLimit(reviewLimiter, getIP(req));
  if (!success) {
    return NextResponse.json(
      { error: "Too many reviews. Please try again later." },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const { builder_id, reviewer_name, reviewer_email, rating, comment, hire_request_id } = body;

    // Validate required fields
    if (!builder_id || !reviewer_name || !reviewer_email || rating === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: builder_id, reviewer_name, reviewer_email, rating" },
        { status: 400 }
      );
    }

    // Validate name
    const nameClean = String(reviewer_name).trim();
    if (nameClean.length < 2 || !/^[a-zA-Z\s'-]+$/.test(nameClean)) {
      return NextResponse.json(
        { error: "Invalid name. Use letters only, at least 2 characters." },
        { status: 400 }
      );
    }

    // Validate email
    const emailClean = String(reviewer_email).trim().toLowerCase();
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(emailClean)) {
      return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
    }

    const emailDomain = emailClean.split("@")[1];
    if (BLOCKED_DOMAINS.includes(emailDomain)) {
      return NextResponse.json(
        { error: "Disposable email addresses are not allowed." },
        { status: 400 }
      );
    }

    // Validate rating
    const ratingNum = Number(rating);
    if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return NextResponse.json(
        { error: "Rating must be an integer between 1 and 5." },
        { status: 400 }
      );
    }

    // Validate comment
    const commentClean = comment ? String(comment).trim().slice(0, 1000) : null;

    // Validate UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(builder_id)) {
      return NextResponse.json({ error: "Invalid builder_id" }, { status: 400 });
    }

    const sb = getSb();

    // Validate hire_request_id if provided
    if (hire_request_id) {
      if (!uuidRegex.test(hire_request_id)) {
        return NextResponse.json({ error: "Invalid hire_request_id" }, { status: 400 });
      }

      const { data: hireRequest, error: hrError } = await sb
        .from("hire_requests")
        .select("id, status")
        .eq("id", hire_request_id)
        .single();

      if (hrError || !hireRequest) {
        return NextResponse.json({ error: "Hire request not found" }, { status: 404 });
      }

      if (hireRequest.status !== "replied") {
        return NextResponse.json(
          { error: "You can only review a builder after they've replied to your request." },
          { status: 400 }
        );
      }

      // Check if a review already exists for this hire request
      const { data: existingReview } = await sb
        .from("reviews")
        .select("id")
        .eq("hire_request_id", hire_request_id)
        .single();

      if (existingReview) {
        return NextResponse.json(
          { error: "A review has already been submitted for this hire request." },
          { status: 409 }
        );
      }
    }

    // --- Compute trust score ---
    // Count existing reviews by this email
    const { count: emailReviewCount } = await sb
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("reviewer_email", emailClean);

    // Count reviews with similar name for this builder
    const { count: sameNameCount } = await sb
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("builder_id", builder_id)
      .ilike("reviewer_name", `%${nameClean.split(" ")[0]}%`);

    // Count reviews by this email in last 24h
    const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
    const { count: recentCount } = await sb
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("reviewer_email", emailClean)
      .gte("created_at", oneDayAgo);

    // Calculate hours since hire request if linked
    let hoursSinceHire: number | null = null;
    if (hire_request_id) {
      const { data: hr } = await sb
        .from("hire_requests")
        .select("created_at")
        .eq("id", hire_request_id)
        .single();
      if (hr) {
        hoursSinceHire = (Date.now() - new Date(hr.created_at).getTime()) / (1000 * 60 * 60);
      }
    }

    const { trust_score } = calculateReviewTrust({
      has_hire_request: !!hire_request_id,
      hire_status: hire_request_id ? "replied" : null,
      reviewer_email: emailClean,
      reviewer_name: nameClean,
      comment: commentClean,
      builder_id,
      existing_reviews_by_email: emailReviewCount || 0,
      same_name_reviews_for_builder: sameNameCount || 0,
      hours_since_hire: hoursSinceHire,
      reviews_last_24h: recentCount || 0,
    });

    const { data, error } = await sb
      .from("reviews")
      .insert({
        builder_id,
        reviewer_name: nameClean,
        reviewer_email: emailClean,
        rating: ratingNum,
        comment: commentClean,
        hire_request_id: hire_request_id || null,
        trust_score,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Failed to insert review:", error);
      return NextResponse.json({ error: "Failed to submit review" }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data.id });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
