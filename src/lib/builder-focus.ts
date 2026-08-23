// How concentrated a builder's recent work is.
//
// WHY THIS EXISTS: vibe_score counts volume. lifetime_contributions is a single
// aggregate with no repo breakdown, so 800 commits spread across forty
// abandoned repos scores exactly the same as 800 commits on one shipped
// product. On /bags that gap matters more than anywhere else, because the
// question the page exists to answer is whether the person behind a token is
// actually building the thing they launched it for.
//
// WHY IT IS NOT PART OF vibe_score: changing that formula rewrites every
// builder's reputation at once, and a focus ratio is a different claim from a
// volume count anyway. This is shown alongside, never folded in.
//
// WHAT IT IS NOT: a verdict. Working across several repositories is normal for
// anyone maintaining more than one thing, and a monorepo scores as perfectly
// focused for free. The number is shown with its inputs so a reader can judge
// it, and it never gates or scores anything.

const GITHUB_API = "https://api.github.com";

/** Public events go back at most ~90 days or 300 events, whichever is smaller. */
const EVENTS_PER_PAGE = 100;

/** Below this, the sample is too thin for a share to mean anything. */
const MIN_PUSHES = 5;

export type FocusSignal = {
  /** Share of pushes landing in the busiest single repo, 0-100. */
  concentration: number;
  /** Distinct repositories pushed to. */
  repoCount: number;
  /** Push events considered. */
  pushes: number;
  /** Busiest repo, "owner/name", for display. */
  topRepo: string | null;
  /** False when there is too little recent activity to say anything. */
  sufficient: boolean;
};

type PushEvent = { type?: unknown; repo?: { name?: unknown } | null };

/**
 * Reduce a builder's recent push events to a concentration figure.
 *
 * Counts push EVENTS rather than commits inside them: a single push can carry
 * one commit or forty, and weighting by size would let one large merge look
 * like sustained focus on a repo the builder touched once.
 */
export function summarizeFocus(events: PushEvent[]): FocusSignal {
  const counts = new Map<string, number>();

  for (const event of events) {
    if (event?.type !== "PushEvent") continue;
    const name = event.repo?.name;
    if (typeof name !== "string" || !name.trim()) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  const pushes = [...counts.values()].reduce((a, b) => a + b, 0);
  if (pushes === 0) {
    return {
      concentration: 0,
      repoCount: 0,
      pushes: 0,
      topRepo: null,
      sufficient: false,
    };
  }

  let topRepo: string | null = null;
  let topCount = 0;
  for (const [repo, count] of counts) {
    // Ties broken by name so the same input always renders the same repo.
    if (
      count > topCount ||
      (count === topCount && topRepo !== null && repo < topRepo)
    ) {
      topRepo = repo;
      topCount = count;
    }
  }

  return {
    concentration: Math.round((topCount / pushes) * 100),
    repoCount: counts.size,
    pushes,
    topRepo,
    sufficient: pushes >= MIN_PUSHES,
  };
}

/**
 * A word for the shape of the work, or null when the sample is too thin.
 *
 * Three bands, deliberately coarse. A precise-looking label on a noisy
 * measurement would imply more confidence than one page of public events
 * supports.
 */
export function focusLabel(signal: FocusSignal): string | null {
  if (!signal.sufficient) return null;
  if (signal.concentration >= 70) return "Focused";
  if (signal.concentration >= 40) return "Split";
  return "Spread thin";
}

/**
 * Recent public push activity for a GitHub user.
 *
 * Fails soft: this is enrichment on a page whose primary claim is verification,
 * and GitHub rate-limits unauthenticated callers hard.
 */
export async function fetchBuilderFocus(
  githubUsername: string,
  token = process.env.GITHUB_TOKEN,
): Promise<FocusSignal | null> {
  if (!githubUsername.trim()) return null;

  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "VibeTalent/1.0",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const res = await fetch(
      `${GITHUB_API}/users/${encodeURIComponent(githubUsername.trim())}/events/public?per_page=${EVENTS_PER_PAGE}`,
      {
        headers,
        signal: AbortSignal.timeout(8_000),
        next: { revalidate: 3600 },
      },
    );
    if (!res.ok) return null;

    const body = await res.json();
    if (!Array.isArray(body)) return null;
    return summarizeFocus(body as PushEvent[]);
  } catch {
    return null;
  }
}
