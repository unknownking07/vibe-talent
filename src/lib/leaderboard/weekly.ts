export const MIN_VIBE_FLOOR = 100;

interface Snapshot {
  user_id: string;
  rank: number;
  vibe_score: number;
}

interface CurrentUser {
  id: string;
  username: string;
  vibe_score: number;
  rank: number;
  avatar_url: string | null;
}

export interface ClimberRow {
  username: string;
  avatar_url: string | null;
  currentRank: number;
  previousRank: number | null;
  rankClimb: number | null;     // null if no snapshot
  currentScore: number;
  scoreDelta: number | null;    // null if no snapshot
}

/**
 * Joins snapshots with current users, computes deltas, applies the floor, and sorts.
 * Sort key: rankClimb desc, scoreDelta desc, currentRank asc.
 * Users without a snapshot appear at the bottom (rankClimb = null sorts last).
 */
export function computeClimbers(snapshots: Snapshot[], current: CurrentUser[]): ClimberRow[] {
  const snapByUser = new Map(snapshots.map((s) => [s.user_id, s]));

  const rows: ClimberRow[] = current
    .filter((u) => u.vibe_score >= MIN_VIBE_FLOOR)
    .map((u) => {
      const snap = snapByUser.get(u.id);
      return {
        username: u.username,
        avatar_url: u.avatar_url,
        currentRank: u.rank,
        previousRank: snap?.rank ?? null,
        rankClimb: snap ? snap.rank - u.rank : null,
        currentScore: u.vibe_score,
        scoreDelta: snap ? u.vibe_score - snap.vibe_score : null,
      };
    });

  rows.sort((a, b) => {
    // Null climb sorts last
    if (a.rankClimb == null && b.rankClimb == null) return a.currentRank - b.currentRank;
    if (a.rankClimb == null) return 1;
    if (b.rankClimb == null) return -1;
    if (b.rankClimb !== a.rankClimb) return b.rankClimb - a.rankClimb;
    return (b.scoreDelta ?? 0) - (a.scoreDelta ?? 0);
  });

  return rows;
}
