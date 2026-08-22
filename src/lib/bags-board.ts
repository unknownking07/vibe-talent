// Aggregation for the /bags board: verified Bags launches, grouped per builder.
//
// Split out from the page so the ranking rule is unit-testable without a
// database. The rule is the opinionated part of this feature: the board exists
// to answer "which of these token launchers actually builds", so it ranks on
// vibe score — VibeTalent's side of the join — and shows launch count as
// supporting evidence rather than as the ranking itself. Ranking by launch
// count would reward minting, which is the one behaviour this page must not
// flatter.

/** A cached row from public.bags_launches. */
export type BagsLaunchRow = {
  token_mint: string;
  user_id: string;
  royalty_bps: number | null;
  first_seen_at: string;
};

/** The builder fields the board needs, as stored on public.users. */
export type BagsBuilderRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  github_username: string | null;
  vibe_score: number | null;
  streak: number | null;
};

/** One builder's launches, ready to render. */
export type BagsBoardEntry = {
  /** Username is non-null here: an entry that cannot link to a profile is dropped. */
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  githubUsername: string | null;
  vibeScore: number;
  streak: number;
  /** Mints this builder created, newest first. */
  mints: string[];
  launchCount: number;
  /** When their earliest known launch first appeared in the cache. */
  firstLaunchAt: string;
};

/**
 * Group launches under their builder and rank them.
 *
 * Launches whose builder is missing or has no username are dropped rather than
 * rendered anonymously: every row on this board is a claim that a named,
 * GitHub-verified person is behind a token, and a row that cannot link to a
 * profile makes that claim without backing it.
 */
export function buildBagsBoard(
  launches: BagsLaunchRow[],
  builders: BagsBuilderRow[],
): BagsBoardEntry[] {
  const byId = new Map<string, BagsBuilderRow>();
  for (const builder of builders) {
    if (builder.username) byId.set(builder.id, builder);
  }

  const grouped = new Map<string, BagsLaunchRow[]>();
  for (const launch of launches) {
    if (!byId.has(launch.user_id)) continue;
    const existing = grouped.get(launch.user_id);
    if (existing) existing.push(launch);
    else grouped.set(launch.user_id, [launch]);
  }

  const entries: BagsBoardEntry[] = [];
  for (const [userId, rows] of grouped) {
    const builder = byId.get(userId)!;
    const newestFirst = [...rows].sort(
      (a, b) => Date.parse(b.first_seen_at) - Date.parse(a.first_seen_at),
    );

    entries.push({
      username: builder.username!,
      displayName: builder.display_name,
      avatarUrl: builder.avatar_url,
      githubUsername: builder.github_username,
      vibeScore: builder.vibe_score ?? 0,
      streak: builder.streak ?? 0,
      mints: newestFirst.map((r) => r.token_mint),
      launchCount: rows.length,
      firstLaunchAt: newestFirst[newestFirst.length - 1]!.first_seen_at,
    });
  }

  // Vibe score first, launches as the tie-break, then username so the order is
  // stable across renders instead of drifting with whatever the DB returned.
  return entries.sort(
    (a, b) =>
      b.vibeScore - a.vibeScore ||
      b.launchCount - a.launchCount ||
      a.username.localeCompare(b.username),
  );
}

/** Shorten a mint for display: the ends are what people actually recognise. */
export function shortMint(mint: string): string {
  return mint.length <= 12 ? mint : `${mint.slice(0, 6)}…${mint.slice(-4)}`;
}
