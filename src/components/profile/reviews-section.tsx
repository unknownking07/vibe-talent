"use client";

import { useState, useEffect } from "react";
import { Star, MessageSquare, Send, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Review } from "@/lib/types/database";

interface ReviewsSectionProps {
  builderId: string;
  isOwner?: boolean;
}

function StarRating({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={size}
          className={
            star <= rating
              ? "fill-amber-500 text-amber-500"
              : "text-[var(--border-subtle)]"
          }
        />
      ))}
    </div>
  );
}

function ClickableStars({
  rating,
  onRate,
  size = 28,
}: {
  rating: number;
  onRate: (r: number) => void;
  size?: number;
}) {
  const [hovered, setHovered] = useState(0);

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onRate(star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          className="transition-transform hover:scale-110"
        >
          <Star
            size={size}
            className={
              star <= (hovered || rating)
                ? "fill-amber-500 text-amber-500"
                : "text-[var(--border-subtle)] hover:text-amber-300"
            }
          />
        </button>
      ))}
      {rating > 0 && (
        <span className="ml-2 text-sm font-bold text-[var(--text-muted)]">
          {rating}/5
        </span>
      )}
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export default function ReviewsSection({ builderId, isOwner = false }: ReviewsSectionProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Review form state
  const [showForm, setShowForm] = useState(false);
  const [formRating, setFormRating] = useState(0);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formComment, setFormComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteEmail, setDeleteEmail] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Auto-fetch logged-in user's name and email
  useEffect(() => {
    async function loadUser() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setIsLoggedIn(true);
        setFormEmail(user.email || "");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: profile } = await (supabase as any)
          .from("users")
          .select("username")
          .eq("id", user.id)
          .single();
        if (profile) {
          setFormName(profile.username || "");
        }
      }
    }
    loadUser();
  }, []);

  useEffect(() => {
    async function loadReviews() {
      try {
        const res = await fetch(`/api/reviews?builder_id=${builderId}`);
        if (res.ok) {
          const data = await res.json();
          setReviews(data.reviews || []);
        } else {
          setError(true);
        }
      } catch (err) {
        console.error("Failed to load reviews:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    loadReviews();
  }, [builderId]);

  const handleSubmitReview = async () => {
    if (!formName.trim() || !formEmail.trim() || formRating === 0) {
      setSubmitError(isLoggedIn ? "Please select a rating." : "Please fill in your name, email, and select a rating.");
      return;
    }

    setSubmitError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          builder_id: builderId,
          reviewer_name: formName.trim(),
          reviewer_email: formEmail.trim(),
          rating: formRating,
          comment: formComment.trim() || null,
        }),
      });

      if (res.ok) {
        setSubmitSuccess(true);
        setShowForm(false);
        setFormRating(0);
        setFormName("");
        setFormEmail("");
        setFormComment("");

        // Reload reviews
        const reviewsRes = await fetch(`/api/reviews?builder_id=${builderId}`);
        if (reviewsRes.ok) {
          const data = await reviewsRes.json();
          setReviews(data.reviews || []);
        }

        setTimeout(() => setSubmitSuccess(false), 3000);
      } else {
        const data = await res.json();
        setSubmitError(data.error || "Failed to submit review.");
      }
    } catch {
      setSubmitError("Failed to submit review. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteReview = async () => {
    if (!deleteId || !deleteEmail.trim()) {
      setDeleteError("Please enter your email to confirm deletion.");
      return;
    }

    setDeleteError("");
    setDeleting(true);

    try {
      const res = await fetch("/api/reviews", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          review_id: deleteId,
          reviewer_email: deleteEmail.trim(),
        }),
      });

      if (res.ok) {
        setDeleteId(null);
        setDeleteEmail("");

        // Reload reviews
        const reviewsRes = await fetch(`/api/reviews?builder_id=${builderId}`);
        if (reviewsRes.ok) {
          const data = await reviewsRes.json();
          setReviews(data.reviews || []);
        }
      } else {
        const data = await res.json();
        setDeleteError(data.error || "Failed to delete review.");
      }
    } catch {
      setDeleteError("Failed to delete review. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="card-brutal p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 rounded w-32" style={{ backgroundColor: "var(--bg-surface-light)" }}></div>
          <div className="h-20 rounded" style={{ backgroundColor: "var(--bg-surface-light)" }}></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card-brutal p-6">
        <h3 className="text-lg font-bold text-[var(--foreground)] mb-2 flex items-center gap-2">
          <MessageSquare size={20} />
          Reviews
        </h3>
        <p className="text-[var(--text-muted)] text-sm">Failed to load reviews.</p>
      </div>
    );
  }

  return (
    <div className="card-brutal p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-[var(--foreground)] flex items-center gap-2">
          <MessageSquare size={20} />
          Reviews
        </h3>
        <div className="flex items-center gap-3">
          {reviews.length > 0 && (
            <span
              className="text-[var(--text-muted)] text-sm"
              aria-label={`${reviews.length} ${reviews.length === 1 ? "review" : "reviews"}`}
            >
              ({reviews.length})
            </span>
          )}
          {!isOwner && !showForm && !(isLoggedIn && reviews.some((r) => r.reviewer_email === formEmail)) && (
            <button
              onClick={() => setShowForm(true)}
              className="btn-brutal text-xs py-1.5 px-3"
              style={{ backgroundColor: "var(--accent)", color: "var(--text-on-inverted)" }}
            >
              Write a Review
            </button>
          )}
        </div>
      </div>

      {/* Success message */}
      {submitSuccess && (
        <div
          className="p-3 mb-4 text-sm font-bold"
          style={{ backgroundColor: "var(--status-success-bg)", color: "var(--status-success-text)", border: "2px solid var(--border-hard)" }}
        >
          Thanks for your review!
        </div>
      )}

      {/* Review form */}
      {showForm && (
        <div
          className="mb-6 p-5 space-y-4"
          style={{ backgroundColor: "var(--bg-surface-light)", border: "2px solid var(--border-hard)" }}
        >
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-extrabold uppercase text-[var(--foreground)]">
              Write a Review
            </h4>
            <button
              onClick={() => { setShowForm(false); setSubmitError(""); }}
              className="text-xs font-bold text-[var(--text-muted)] hover:text-[var(--foreground)]"
            >
              Cancel
            </button>
          </div>

          {/* Star selection */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-2 block">
              Rating *
            </label>
            <ClickableStars rating={formRating} onRate={setFormRating} />
          </div>

          {/* Name (auto-filled if logged in) */}
          {isLoggedIn ? (
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-1.5 block">
                Reviewing as
              </label>
              <div className="input-brutal w-full cursor-default" style={{ backgroundColor: "var(--bg-surface-light)", color: "var(--text-secondary)" }}>
                {formName}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-1.5 block">
                  Your Name *
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="John Doe"
                  className="input-brutal w-full"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-1.5 block">
                  Email *
                </label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="john@example.com"
                  className="input-brutal w-full"
                />
              </div>
            </div>
          )}

          {/* Comment */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-1.5 block">
              Comment (optional)
            </label>
            <textarea
              value={formComment}
              onChange={(e) => setFormComment(e.target.value)}
              placeholder="How was your experience working with this builder?"
              rows={3}
              className="input-brutal w-full resize-none"
              maxLength={1000}
            />
          </div>

          {/* Error */}
          {submitError && (
            <div
              className="p-3 text-sm font-bold text-[var(--status-error-text)]"
              style={{ backgroundColor: "var(--status-error-bg)", border: "2px solid var(--border-hard)" }}
            >
              {submitError}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmitReview}
            disabled={submitting || formRating === 0}
            className="btn-brutal btn-brutal-primary w-full justify-center text-sm flex items-center gap-2"
          >
            <Send size={14} />
            {submitting ? "Submitting..." : "Submit Review"}
          </button>
        </div>
      )}

      {/* Reviews list */}
      {reviews.length === 0 ? (
        <p className="text-[var(--text-muted)] text-sm">No reviews yet.{!isOwner && " Be the first to leave one!"}</p>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <div
              key={review.id}
              className="border-2 p-4"
              style={{ borderColor: "var(--border-subtle)" }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-[var(--foreground)] text-sm">
                    {review.reviewer_name}
                  </span>
                  <StarRating rating={review.rating} size={14} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--text-muted-soft)] text-xs font-mono">
                    {timeAgo(review.created_at)}
                  </span>
                  {isLoggedIn && formEmail === review.reviewer_email && (
                    <button
                      onClick={() => { setDeleteId(review.id); setDeleteEmail(""); setDeleteError(""); }}
                      className="text-[var(--text-muted-soft)] hover:text-red-500 transition-colors"
                      title="Delete your review"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
              {review.comment && (
                <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
                  {review.comment}
                </p>
              )}
              {deleteId === review.id && (
                <div
                  className="mt-3 p-3 space-y-2"
                  style={{ backgroundColor: "var(--status-error-bg)", border: "2px solid var(--border-hard)" }}
                >
                  <p className="text-xs font-bold text-[var(--foreground)]">
                    Enter the email you used when writing this review to confirm deletion:
                  </p>
                  <input
                    type="email"
                    value={deleteEmail}
                    onChange={(e) => setDeleteEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="input-brutal w-full text-sm"
                  />
                  {deleteError && (
                    <p className="text-xs font-bold text-red-600">{deleteError}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={handleDeleteReview}
                      disabled={deleting}
                      className="btn-brutal text-xs py-1.5 px-3 bg-red-500 text-white hover:bg-red-600"
                    >
                      {deleting ? "Deleting..." : "Confirm Delete"}
                    </button>
                    <button
                      onClick={() => { setDeleteId(null); setDeleteError(""); }}
                      className="btn-brutal text-xs py-1.5 px-3"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export { StarRating };
