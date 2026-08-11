import { TIER_THRESHOLDS, type ReviewerTier } from "@/lib/reviewer/tier";

interface ReviewerStatsProps {
  reviewsGiven: number;          // count of reviews where reviewer_user_id = this user
  reviewsLast30d: number;        // subset
  calibration: number | null;    // 0-100 or null
  tier: ReviewerTier | null;
}

const TIER_STYLES: Record<ReviewerTier, { bg: string; label: string }> = {
  bronze: { bg: "bg-[#D97706]", label: "Bronze" },
  silver: { bg: "bg-[#71717A]", label: "Silver" },
  gold:   { bg: "bg-[#CA8A04]", label: "Gold" },
};

export function ReviewerStats({ reviewsGiven, reviewsLast30d, calibration, tier }: ReviewerStatsProps) {
  // Hide block entirely if user has never reviewed anyone — keeps non-reviewer profiles clean.
  if (reviewsGiven === 0) return null;

  return (
    <section
      className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 sm:p-5 rounded-2xl"
      style={{ boxShadow: "var(--shadow-brutal-sm)" }}
      aria-labelledby="reviewer-stats-heading"
    >
      <header className="flex items-center justify-between pb-3 mb-4 border-b border-[var(--border-subtle)]">
        <h3 id="reviewer-stats-heading" className="text-[15px] font-semibold text-[var(--text-secondary)]">
          Reviewer
        </h3>
        {tier && (
          <span
            className={`${TIER_STYLES[tier].bg} text-white px-3 py-1 text-[11px] font-semibold rounded-full`}
          >
            {TIER_STYLES[tier].label}
          </span>
        )}
      </header>

      <div className="grid grid-cols-2 gap-3">
        <Stat number={reviewsGiven.toString()} label="Reviews given" tooltip={`${reviewsLast30d} in last 30d`} />
        <Stat
          number={calibration != null ? `${Math.round(calibration)}%`: ": "}
          label="Calibration"
          tooltip={calibration != null ? "stars vs builder rank" : `need ${TIER_THRESHOLDS.bronze.minReviews - reviewsGiven} more reviews`}
        />
      </div>
    </section>
  );
}

function Stat({ number, label, tooltip }: { number: string; label: string; tooltip: string }) {
  return (
    <div>
      <div className="font-mono font-extrabold text-[22px] leading-none text-[var(--accent)]">{number}</div>
      <div className="text-xs font-medium text-[var(--text-muted)] mt-1">{label}</div>
      <div className="text-[10px] font-mono text-[var(--text-muted)] mt-1">{tooltip}</div>
    </div>
  );
}
