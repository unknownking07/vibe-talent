// Aggregation for the /bags board: verified Bags launches, grouped per builder.
//
// Split out from the page so the ranking rule is unit-testable without a
// database. The rule is the opinionated part of this feature: the board exists
// to answer "which of these token launchers actually builds", so it ranks on
// vibe score — VibeTalent's side of the join — and shows launch count as
// supporting evidence rather than as the ranking itself. Ranking by launch
// count would reward minting, which is the one behaviour this page must not
// flatter.

/**
 * A cached row from public.bags_launches.
 *
 * user_id is the claim flag: set means a builder proved the launching wallet by
 * signature, null means the launch was discovered on Bags and nobody has
 * claimed it.
 */
export type BagsLaunchRow = {
  token_mint: string;
  user_id: string | null;
  royalty_bps: number | null;
  first_seen_at: string;
  creator_wallet?: string;
  bags_username?: string | null;
  twitter_username?: string | null;
  token_name?: string | null;
  token_symbol?: string | null;
  token_image_url?: string | null;
  fdv_usd?: number | null;
  volume_24h_usd?: number | null;
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
 * The bar for appearing on the verified board.
 *
 * Two requirements, both load-bearing for what the page claims. A username, or
 * the row cannot link to the profile that backs it. And a GitHub handle,
 * because the board states in as many words that every builder on it is
 * GitHub-verified, and linking a wallet does not require GitHub.
 *
 * Defined once because buildBagsBoard and buildUnverifiedLaunches partition the
 * same launches against it: two copies that drifted would list a launch in both
 * sections, or in neither.
 */
export function clearsVerifiedBar(
  builder: BagsBuilderRow | undefined | null,
): boolean {
  return Boolean(builder?.username && builder.github_username?.trim());
}

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
    if (clearsVerifiedBar(builder)) byId.set(builder.id, builder);
  }

  const grouped = new Map<string, BagsLaunchRow[]>();
  for (const launch of launches) {
    if (!launch.user_id || !byId.has(launch.user_id)) continue;
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

/**
 * A launch the board lists WITHOUT vouching for the person behind it.
 *
 * Two different situations share this shape, and the label keeps them apart:
 * "unclaimed" means nobody has proved the launching wallet, and "unverified"
 * means a VibeTalent profile owns it but does not clear the bar the verified
 * section states. Neither may ever be styled as, or mistaken for, verified.
 */
export type UnverifiedLaunch = {
  mint: string;
  /** Raw, straight from the launcher. Sanitise before rendering. */
  name: string | null;
  symbol: string | null;
  imageUrl: string | null;
  fdvUsd: number | null;
  volume24hUsd: number | null;
  /** Creator identity as Bags reports it. Never used to attribute the launch. */
  bagsUsername: string | null;
  twitterUsername: string | null;
  /** Set only when a VibeTalent profile owns the launch but is not verified. */
  profileUsername: string | null;
};

/**
 * Launches the verified board cannot carry, busiest first.
 *
 * Deliberately includes claimed-but-unverified launches. Dropping them would
 * mean a builder who linked a wallet sees their coin vanish from the board
 * entirely, which reads as a bug and removes the nudge to finish verifying.
 */
export function buildUnverifiedLaunches(
  launches: BagsLaunchRow[],
  builders: BagsBuilderRow[],
): UnverifiedLaunch[] {
  const byId = new Map<string, BagsBuilderRow>();
  for (const builder of builders) byId.set(builder.id, builder);

  const out: UnverifiedLaunch[] = [];
  for (const launch of launches) {
    const builder = launch.user_id ? byId.get(launch.user_id) : undefined;

    // A launch that clears the bar belongs on the verified board, not here.
    if (clearsVerifiedBar(builder)) continue;

    out.push({
      mint: launch.token_mint,
      name: launch.token_name ?? null,
      symbol: launch.token_symbol ?? null,
      imageUrl: launch.token_image_url ?? null,
      fdvUsd: launch.fdv_usd ?? null,
      volume24hUsd: launch.volume_24h_usd ?? null,
      bagsUsername: launch.bags_username ?? null,
      twitterUsername: launch.twitter_username ?? null,
      profileUsername: builder?.username ?? null,
    });
  }

  // Busiest first: volume is the only ranking here that does not imply a
  // judgement about the person, which is the whole point of this section.
  return out.sort(
    (a, b) =>
      (b.volume24hUsd ?? 0) - (a.volume24hUsd ?? 0) ||
      a.mint.localeCompare(b.mint),
  );
}
