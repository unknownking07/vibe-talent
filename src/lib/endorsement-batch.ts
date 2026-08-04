/**
 * Coalesces the per-card endorsement lookups into one request.
 *
 * Every `<EndorseButton>` checks its own state on mount. On a grid of project
 * cards that meant one `/api/endorsements` call per card — each a separate
 * Cloudflare Worker invocation that re-ran `auth.getUser()` against Supabase.
 * A homepage load was measurably spending ~800ms per card on this.
 *
 * All those effects run in the same tick, so a zero-delay timer is enough to
 * gather them into a single `?project_ids=` request. Callers keep a plain
 * promise-returning API and don't need to know they were batched.
 */

export type EndorsementState = { count: number; user_endorsed: boolean };

type Waiter = {
  id: string;
  resolve: (state: EndorsementState) => void;
  reject: (reason: unknown) => void;
};

// Mirrors MAX_BATCH_PROJECT_IDS in the route handler — larger requests are
// rejected there, so split before sending rather than after being refused.
const MAX_BATCH = 50;

let queue: Waiter[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

async function flushChunk(waiters: Waiter[], ids: string[]) {
  try {
    const res = await fetch(
      `/api/endorsements?project_ids=${ids.map(encodeURIComponent).join(",")}`,
    );
    if (!res.ok) throw new Error(`Endorsements request failed: ${res.status}`);

    const body = (await res.json()) as { results?: Record<string, EndorsementState> };
    for (const waiter of waiters) {
      const state = body.results?.[waiter.id];
      if (state) waiter.resolve(state);
      else waiter.reject(new Error(`No endorsement state for project ${waiter.id}`));
    }
  } catch (err) {
    for (const waiter of waiters) waiter.reject(err);
  }
}

function flush() {
  const batch = queue;
  queue = [];
  timer = null;

  // Several buttons can ask for the same project (a builder's project appearing
  // in two sections), so dedupe the ids while still settling every waiter.
  const uniqueIds = [...new Set(batch.map((w) => w.id))];

  for (let i = 0; i < uniqueIds.length; i += MAX_BATCH) {
    const ids = uniqueIds.slice(i, i + MAX_BATCH);
    const inChunk = new Set(ids);
    void flushChunk(
      batch.filter((w) => inChunk.has(w.id)),
      ids,
    );
  }
}

/** Resolves this project's endorsement state, batched with any concurrent asks. */
export function fetchEndorsementState(projectId: string): Promise<EndorsementState> {
  return new Promise((resolve, reject) => {
    queue.push({ id: projectId, resolve, reject });
    timer ??= setTimeout(flush, 0);
  });
}
