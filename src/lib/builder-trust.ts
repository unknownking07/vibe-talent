// Builder trust for the /bags pages.
//
// WHY THIS IS A TRANSLATION, NOT A NEW SCORE: vibe_score already measures
// building — streaks, verified projects, quality, endorsements, contribution
// volume. Deriving a second number from the same inputs would add no
// information and would eventually disagree with the leaderboard, which is the
// opposite of trust. What a visitor arriving from Bags actually lacks is a
// frame of reference: "265" means nothing to them, "top 6% of builders" does.
// So this ranks the existing score and shows the receipts behind it.
//
// WHY IT NEVER TOUCHES TOKEN RISK: mint authority, dev holdings and holder
// concentration belong to the coin, not the person. Averaging them into a
// builder number would let a long streak make a rug-shaped launch look safe,
// which is the one failure this page cannot afford. Those stay a separate,
// unblendable checklist.

import { VIBE_SCORE } from "@/lib/scoring-config";

/** Everything the assessment reads about one builder. */
export type BuilderTrustInput = {
  vibeScore: number;
  /** GitHub-verified projects. The strongest single piece of evidence. */
  verifiedProjects: number;
  /** Commits attributed by the GitHub sync, lifetime. */
  lifetimeContributions: number;
  longestStreak: number;
};

export type BuilderTrust = {
  /**
   * Share of ranked builders this one is ahead of, 0-100. Null whenever the
   * record is too thin to place them, which is a deliberate refusal rather
   * than a zero.
   */
  percentile: number | null;
  /** Human-readable headline. Always safe to render. */
  label: string;
  /** False when the evidence does not support ranking them at all. */
  sufficient: boolean;
  /** Why a rank was withheld, shown to the reader instead of hidden. */
  caveat: string | null;
};

/**
 * The cohort a percentile is measured against: everyone who has done anything
 * at all. Ranking against all rows — including accounts that signed up and
 * left — would flatter every active builder into the top decile.
 */
export function rankedCohort(allScores: number[]): number[] {
  return allScores.filter((s) => s > VIBE_SCORE.baseline);
}

/**
 * Percentage of the cohort scoring strictly below `score`, rounded.
 *
 * Strictly-below (rather than at-or-below) means a builder is never told they
 * beat someone they merely tied.
 */
export function percentileOf(score: number, cohort: number[]): number | null {
  if (cohort.length === 0) return null;
  const below = cohort.filter((s) => s < score).length;
  return Math.round((below / cohort.length) * 100);
}

/**
 * Does this record support a public ranking?
 *
 * Requires evidence that leaves VibeTalent: a GitHub-verified project or
 * attributed commits. A streak on its own does not qualify — it accrues from
 * activity on this platform, and production has builders carrying 100+ day
 * streaks with zero verified projects and zero contributions. Ranking those in
 * the top decile beside a token launch would vouch for something nobody
 * outside this database can check.
 */
export function hasVerifiableRecord(input: BuilderTrustInput): boolean {
  return input.verifiedProjects > 0 || input.lifetimeContributions > 0;
}

/** Rank a builder against their peers, or explain why they cannot be ranked. */
export function assessBuilderTrust(
  input: BuilderTrustInput,
  allScores: number[],
): BuilderTrust {
  if (!hasVerifiableRecord(input)) {
    return {
      percentile: null,
      label: "Limited public record",
      sufficient: false,
      caveat:
        input.longestStreak > 0
          ? "This builder has a streak on VibeTalent but no GitHub-verified project or attributed commits yet, so there is nothing external to rank."
          : "Not enough verified building activity to rank this builder yet.",
    };
  }

  const percentile = percentileOf(input.vibeScore, rankedCohort(allScores));
  if (percentile === null) {
    return {
      percentile: null,
      label: "Unranked",
      sufficient: false,
      caveat: "No comparable builders to rank against.",
    };
  }

  return {
    percentile,
    label:
      percentile >= 50
        ? `Top ${Math.max(100 - percentile, 1)}% of builders`
        : "Ranked builder",
    sufficient: true,
    caveat: null,
  };
}
