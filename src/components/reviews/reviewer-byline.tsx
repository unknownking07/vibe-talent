import type { ReviewerTier } from "@/lib/reviewer/tier";

interface ReviewerBylineProps {
  reviewerName: string;
  reviewerUsername?: string | null;   // present when reviewer_user_id is set
  reviewsGiven?: number | null;
  calibration?: number | null;
  tier?: ReviewerTier | null;
}

const TIER_STYLES: Record<ReviewerTier, string> = {
  bronze: "bg-[#D97706]",
  silver: "bg-[#71717A]",
  gold:   "bg-[#CA8A04]",
};

export function ReviewerByline({
  reviewerName,
  reviewerUsername,
  reviewsGiven,
  calibration,
  tier,
}: ReviewerBylineProps) {
  // Anonymous reviewer (no linked user) — fall back to plain name.
  if (!reviewerUsername) {
    return (
      <div className="text-[13px] text-[var(--text-secondary)]">
        reviewed by <b className="text-[var(--foreground)]">{reviewerName}</b>
      </div>
    );
  }

  const hasMeta = (reviewsGiven != null && reviewsGiven > 0) || calibration != null;

  return (
    <div className="flex items-center gap-2 flex-wrap text-[13px] text-[var(--text-secondary)]">
      <span>reviewed by <b className="text-[var(--foreground)]">@{reviewerUsername}</b></span>
      {hasMeta && (
        <span className="font-mono">
          {reviewsGiven != null && reviewsGiven > 0 && `· ${reviewsGiven} reviews`}
          {calibration != null && ` · ${Math.round(calibration)}% cal`}
        </span>
      )}
      {tier && (
        <span className={`${TIER_STYLES[tier]} text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-sm tracking-wider`}>
          {tier.toUpperCase()}
        </span>
      )}
    </div>
  );
}
