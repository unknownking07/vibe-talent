"use client";

import { useState, useEffect } from "react";
import { Star, MessageSquare } from "lucide-react";
import type { Review } from "@/lib/types/database";

interface ReviewsSectionProps {
  builderId: string;
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
              : "text-zinc-300"
          }
        />
      ))}
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

export default function ReviewsSection({ builderId }: ReviewsSectionProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [avgRating, setAvgRating] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function loadReviews() {
      try {
        const res = await fetch(`/api/reviews?builder_id=${builderId}`);
        if (res.ok) {
          const data = await res.json();
          setReviews(data.reviews || []);
          setAvgRating(data.average_rating || 0);
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

  if (loading) {
    return (
      <div className="card-brutal p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-zinc-200 rounded w-32"></div>
          <div className="h-20 bg-zinc-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card-brutal p-6">
        <h3 className="text-lg font-bold text-zinc-900 mb-2 flex items-center gap-2">
          <MessageSquare size={20} />
          Reviews
        </h3>
        <p className="text-zinc-500 text-sm">Failed to load reviews.</p>
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="card-brutal p-6">
        <h3 className="text-lg font-bold text-zinc-900 mb-2 flex items-center gap-2">
          <MessageSquare size={20} />
          Reviews
        </h3>
        <p className="text-zinc-500 text-sm">No reviews yet.</p>
      </div>
    );
  }

  return (
    <div className="card-brutal p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
          <MessageSquare size={20} />
          Reviews
        </h3>
        <div className="flex items-center gap-2">
          <StarRating rating={Math.round(avgRating)} size={18} />
          <span className="font-mono font-bold text-zinc-900">{avgRating}</span>
          <span className="text-zinc-500 text-sm">({reviews.length})</span>
        </div>
      </div>

      <div className="space-y-4">
        {reviews.map((review) => (
          <div
            key={review.id}
            className="border-2 border-zinc-200 p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <span className="font-bold text-zinc-900 text-sm">
                  {review.reviewer_name}
                </span>
                <StarRating rating={review.rating} size={14} />
              </div>
              <span className="text-zinc-400 text-xs font-mono">
                {timeAgo(review.created_at)}
              </span>
            </div>
            {review.comment && (
              <p className="text-zinc-600 text-sm leading-relaxed">
                {review.comment}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export { StarRating };
