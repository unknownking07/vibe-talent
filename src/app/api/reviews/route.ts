import { NextRequest, NextResponse } from "next/server";
import { reviewLimiter, getIP, checkRateLimit } from "@/lib/rate-limit";
import { calculateReviewTrust } from "@/lib/review-trust";
import { createNotification } from "@/lib/notifications";
import { sendReviewNotificationEmail } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateName, validateEmail, validateUUID, BLOCKED_DOMAINS } from "@/lib/validation";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const builderId = searchParams.get("builder_id");

    if (!builderId) {
      return NextResponse.json({ error: "builder_id is required" }, { status: 400 });
    }

    if (!validateUUID(builderId)) {
      return NextResponse.json({ error: "Invalid builder_id" }, { status: 400 });
    }

    const sb = createAdminClient();
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

    // Strip trust_score from public response to avoid exposing anti-abuse thresholds
    const publicReviews = reviews.map(({ trust_score: _ts, ...rest }: { trust_score?: number; [key: string]: unknown }) => rest);

    return NextResponse.json({
      reviews: publicReviews,
      average_rating: avgRating,
      total_reviews: reviews.length,
      trusted_reviews: trustedReviews.length,
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { review_id, reviewer_email } = body;

    if (!review_id || !reviewer_email) {
      return NextResponse.json(
        { error: "review_id and reviewer_email are required" },
        { status: 400 }
      );
    }

    if (!validateUUID(review_id)) {
      return NextResponse.json({ error: "Invalid review_id" }, { status: 400 });
    }

    const emailClean = String(reviewer_email).trim().toLowerCase();
    const sb = createAdminClient();

    // Verify the review exists and belongs to this email
    const { data: review, error: fetchErr } = await sb
      .from("reviews")
      .select("id, reviewer_email")
      .eq("id", review_id)
      .single();

    if (fetchErr || !review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    if (review.reviewer_email !== emailClean) {
      return NextResponse.json(
        { error: "Email does not match. You can only delete your own review." },
        { status: 403 }
      );
    }

    const { error: deleteErr } = await sb
      .from("reviews")
      .delete()
      .eq("id", review_id);

    if (deleteErr) {
      console.error("Failed to delete review:", deleteErr);
      return NextResponse.json({ error: "Failed to delete review" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
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
    const nameResult = validateName(reviewer_name);
    if (!nameResult.valid) {
      return NextResponse.json({ error: nameResult.error }, { status: 400 });
    }
    const nameClean = nameResult.cleaned;

    // Validate email
    const emailResult = validateEmail(reviewer_email);
    if (!emailResult.valid) {
      return NextResponse.json({ error: emailResult.error }, { status: 400 });
    }
    const emailClean = emailResult.cleaned;

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
    if (!validateUUID(builder_id)) {
      return NextResponse.json({ error: "Invalid builder_id" }, { status: 400 });
    }

    const sb = createAdminClient();

    // Prevent duplicate reviews: one review per email per builder
    const { data: existingByEmail } = await sb
      .from("reviews")
      .select("id")
      .eq("builder_id", builder_id)
      .eq("reviewer_email", emailClean)
      .maybeSingle();

    if (existingByEmail) {
      return NextResponse.json(
        { error: "You have already reviewed this builder. Delete your existing review first to submit a new one." },
        { status: 409 }
      );
    }

    // Validate hire_request_id if provided
    if (hire_request_id) {
      if (!validateUUID(hire_request_id)) {
        return NextResponse.json({ error: "Invalid hire_request_id" }, { status: 400 });
      }

      const { data: hireRequest, error: hrError } = await sb
        .from("hire_requests")
        .select("id, builder_id, status")
        .eq("id", hire_request_id)
        .single();

      if (hrError || !hireRequest) {
        return NextResponse.json({ error: "Hire request not found" }, { status: 404 });
      }

      // Ensure the hire request belongs to the builder being reviewed
      if (hireRequest.builder_id !== builder_id) {
        return NextResponse.json({ error: "Hire request does not belong to this builder" }, { status: 400 });
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

    // Fire-and-forget: in-app notification for the builder
    createNotification({
      user_id: builder_id,
      type: "new_review",
      title: "New review received",
      message: `${nameClean} left you a ${ratingNum}-star review`,
      metadata: { review_id: data.id, reviewer_name: nameClean, rating: ratingNum },
    }).catch(console.error);

    // Fire-and-forget: email notification to the builder
    const adminSb = createAdminClient();
    adminSb.auth.admin.getUserById(builder_id).then(({ data: userData }) => {
      if (userData?.user?.email) {
        adminSb
          .from("users")
          .select("username")
          .eq("id", builder_id)
          .single()
          .then(({ data: builderData }) => {
            sendReviewNotificationEmail({
              email: userData.user!.email!,
              username: builderData?.username || "builder",
              reviewerName: nameClean,
              rating: ratingNum,
              comment: commentClean,
            }).catch(console.error);
          });
      }
    }).catch(console.error);

    return NextResponse.json({ success: true, id: data.id });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
