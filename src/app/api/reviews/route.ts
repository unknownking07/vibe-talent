import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { reviewLimiter, getIP, checkRateLimit } from "@/lib/rate-limit";
import { createNotification } from "@/lib/notifications";
import { sendReviewNotificationEmail } from "@/lib/email";

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

function getAdminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
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
      .select("id, builder_id, reviewer_name, rating, comment, created_at")
      .eq("builder_id", builderId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch reviews:", error);
      return NextResponse.json({ error: "Failed to fetch reviews" }, { status: 500 });
    }

    // Calculate average rating
    const reviews = data || [];
    const avgRating = reviews.length > 0
      ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10) / 10
      : 0;

    return NextResponse.json({
      reviews,
      average_rating: avgRating,
      total_reviews: reviews.length,
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

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(review_id)) {
      return NextResponse.json({ error: "Invalid review_id" }, { status: 400 });
    }

    const emailClean = String(reviewer_email).trim().toLowerCase();
    const sb = getAdminSb();

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

    const { data, error } = await sb
      .from("reviews")
      .insert({
        builder_id,
        reviewer_name: nameClean,
        reviewer_email: emailClean,
        rating: ratingNum,
        comment: commentClean,
        hire_request_id: hire_request_id || null,
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
    const adminSb = getAdminSb();
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
