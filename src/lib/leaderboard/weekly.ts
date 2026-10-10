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

export interface ActiveBuilderRow {
  username: string;
  avatar_url: string | null;
  currentRank: number;
  activeDays7d: number;     // 0-7
  commits7d: number;        // sum of streak_logs.commit_count in last 7d
  streak: number;
  vibeScore: number;
}

interface CurrentUserForActive {
  id: string;
  username: string;
  vibe_score: number;
  streak: number;
  avatar_url: string | null;
  rank: number;
}

/**
 * Joins active-days + commit counts with current users.
 * Includes zero-activity builders: activity cannot affect ranking eligibility.
 * Rank by vibe score; activity is display-only and never breaks a tie.
 */
export function computeActiveBuilders(
  activeDaysByUserId: Map<string, number>,
  commitsByUserId: Map<string, number>,
  current: CurrentUserForActive[],
): ActiveBuilderRow[] {
  const rows: ActiveBuilderRow[] = [];
  for (const u of current) {
    const days = activeDaysByUserId.get(u.id) ?? 0;
    rows.push({
      username: u.username,
      avatar_url: u.avatar_url,
      currentRank: u.rank,
      activeDays7d: days,
      commits7d: commitsByUserId.get(u.id) ?? 0,
      streak: u.streak,
      vibeScore: u.vibe_score,
    });
  }
  rows.sort((a, b) => b.vibeScore - a.vibeScore || a.username.localeCompare(b.username));
  return rows;
}
