# Social Visibility Pack — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship five social-visibility features (weekly leaderboard, profile share card, receipts, GitHub commit signal, reviewer reputation) as one PR on `feat/social-visibility-pack`.

**Architecture:** Additive schema (one migration), no new Vercel crons, extend existing `daily` + `quality-rescore` + `weekly-digest`. OG images via Next.js `next/og` (`ImageResponse`). Tests are vitest + jsdom on lib functions; UI is visually tested on `npm run dev` before push.

**Tech Stack:** Next.js 16, React 19, Supabase, Tailwind v4 (CSS vars), `next/og`, vitest, Resend.

**Spec reference:** `docs/superpowers/specs/2026-05-12-social-visibility-design.md`

---

## Pre-flight (Task 0)

### Task 0: Branch setup

**Files:**
- None created. Branch operation only.

- [ ] **Step 0.1: Stash current WIP if any**

```bash
git status
# If there are uncommitted changes on fix/notifications-page-and-display-name, stash them:
git stash push -u -m "wip-before-social-visibility-pack"
```

- [ ] **Step 0.2: Create new branch from main**

```bash
git fetch origin
git switch -c feat/social-visibility-pack origin/main
```

- [ ] **Step 0.3: Confirm `.gitignore` already excludes `docs/superpowers/`**

```bash
grep "docs/superpowers/" .gitignore
# Expected: docs/superpowers/
```

If missing, add it and commit before any feature work.

- [ ] **Step 0.4: Confirm test runner works**

```bash
npm run test -- src/lib/__tests__/streak.test.ts
# Expected: passing tests
```

---

## Task 1: Migration — schema additions

**Files:**
- Create: `supabase/migrations/20260512_social_visibility_pack.sql`

- [ ] **Step 1.1: Write the migration**

```sql
-- Migration: Social Visibility Pack
-- Adds weekly score snapshots, reviewer reputation columns, and reviewer→user link.
-- All changes are additive and nullable; safe to roll forward without backfill.

-- 1. Weekly snapshots (Monday rows only) for "climbed +N spots this week" math.
create table public.vibe_score_weekly_snapshots (
  user_id uuid not null references public.users(id) on delete cascade,
  week_start date not null,
  vibe_score integer not null,
  rank integer not null,
  commits_7d integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, week_start)
);

create index vibe_score_weekly_snapshots_week_rank_idx
  on public.vibe_score_weekly_snapshots (week_start, rank);

alter table public.vibe_score_weekly_snapshots enable row level security;

create policy "weekly_snapshots_public_read"
  on public.vibe_score_weekly_snapshots for select using (true);

-- 2. Reviewer reputation columns on users (distinct from existing badge_level).
alter table public.users
  add column reviewer_calibration numeric(5,2),
  add column reviewer_tier text
    check (reviewer_tier is null or reviewer_tier in ('bronze','silver','gold'));

-- 3. Link reviews to logged-in reviewers. Anonymous reviews stay null.
alter table public.reviews
  add column reviewer_user_id uuid references public.users(id) on delete set null;

create index reviews_reviewer_user_id_idx
  on public.reviews (reviewer_user_id) where reviewer_user_id is not null;

-- ROLLBACK (commented; uncomment + run if needed):
-- alter table public.reviews drop column if exists reviewer_user_id;
-- alter table public.users
--   drop column if exists reviewer_calibration,
--   drop column if exists reviewer_tier;
-- drop table if exists public.vibe_score_weekly_snapshots;
```

- [ ] **Step 1.2: Apply locally with supabase CLI**

```bash
supabase db reset       # or supabase migration up
# Expected: migration 20260512 applied cleanly, no errors
```

- [ ] **Step 1.3: Verify schema in psql / Supabase dashboard**

```sql
select column_name, data_type, is_nullable
  from information_schema.columns
  where table_name = 'users'
    and column_name in ('reviewer_calibration', 'reviewer_tier');
-- Expected: 2 rows, both nullable

select column_name from information_schema.columns
  where table_name = 'reviews' and column_name = 'reviewer_user_id';
-- Expected: 1 row

select * from public.vibe_score_weekly_snapshots limit 1;
-- Expected: empty table, no error
```

- [ ] **Step 1.4: Commit**

```bash
git add supabase/migrations/20260512_social_visibility_pack.sql
git commit -m "feat(db): vibe_score_weekly_snapshots + reviewer columns + reviewer_user_id"
```

---

## Task 2: Reviewer calibration math (pure function)

**Files:**
- Create: `src/lib/reviewer/calibration.ts`
- Create: `src/lib/reviewer/__tests__/calibration.test.ts`

- [ ] **Step 2.1: Write the failing test**

```typescript
// src/lib/reviewer/__tests__/calibration.test.ts
import { describe, it, expect } from "vitest";
import { computeCalibration } from "../calibration";

describe("computeCalibration", () => {
  it("returns null when reviewer has < 5 reviews", () => {
    const reviews = [
      { rating: 5, builderPercentile: 0.9 },
      { rating: 4, builderPercentile: 0.8 },
    ];
    expect(computeCalibration(reviews)).toBeNull();
  });

  it("returns 100 when every review perfectly matches the builder's percentile", () => {
    // rating 5 → normalized 1.0; builder in 100th percentile → 1.0 → error 0
    const reviews = [
      { rating: 5, builderPercentile: 1.0 },
      { rating: 5, builderPercentile: 1.0 },
      { rating: 5, builderPercentile: 1.0 },
      { rating: 5, builderPercentile: 1.0 },
      { rating: 5, builderPercentile: 1.0 },
    ];
    expect(computeCalibration(reviews)).toBe(100);
  });

  it("returns 0 when every review is maximally wrong", () => {
    // rating 5 → 1.0; builder bottom percentile → 0.0 → error 1.0
    const reviews = Array(5).fill({ rating: 5, builderPercentile: 0.0 });
    expect(computeCalibration(reviews)).toBe(0);
  });

  it("computes a partial calibration correctly", () => {
    // rating 4 → 0.8; builder 0.7 → error 0.1; five copies → mean error 0.1
    // calibration = 100 - 0.1 * 100 = 90
    const reviews = Array(5).fill({ rating: 4, builderPercentile: 0.7 });
    expect(computeCalibration(reviews)).toBe(90);
  });

  it("rounds to 2 decimals", () => {
    const reviews = [
      { rating: 5, builderPercentile: 0.95 }, // error 0.05
      { rating: 4, builderPercentile: 0.75 }, // error 0.05
      { rating: 3, builderPercentile: 0.55 }, // error 0.05
      { rating: 2, builderPercentile: 0.35 }, // error 0.05
      { rating: 1, builderPercentile: 0.15 }, // error 0.05
    ];
    // mean error = 0.05, calibration = 100 - 5 = 95
    expect(computeCalibration(reviews)).toBe(95);
  });
});
```

- [ ] **Step 2.2: Run and verify failure**

```bash
npm run test -- src/lib/reviewer/__tests__/calibration.test.ts
# Expected: FAIL — cannot find module "../calibration"
```

- [ ] **Step 2.3: Implement minimal calibration**

```typescript
// src/lib/reviewer/calibration.ts
export const MIN_REVIEWS_FOR_CALIBRATION = 5;

export interface ReviewForCalibration {
  rating: number;          // 1-5
  builderPercentile: number; // 0.0-1.0
}

/**
 * Calibration score = 100 - (mean absolute error between normalized rating and builder percentile) * 100.
 * Returns null when reviewer has fewer than MIN_REVIEWS_FOR_CALIBRATION reviews.
 *
 * Normalized rating: rating / 5 (so 5★ = 1.0, 1★ = 0.2).
 * builderPercentile: the reviewed builder's rank percentile across all users (0.0 worst, 1.0 best).
 */
export function computeCalibration(reviews: ReviewForCalibration[]): number | null {
  if (reviews.length < MIN_REVIEWS_FOR_CALIBRATION) return null;

  const errors = reviews.map((r) => Math.abs(r.rating / 5 - r.builderPercentile));
  const meanError = errors.reduce((s, e) => s + e, 0) / errors.length;
  const calibration = 100 - meanError * 100;

  return Math.round(calibration * 100) / 100;
}
```

- [ ] **Step 2.4: Run and verify pass**

```bash
npm run test -- src/lib/reviewer/__tests__/calibration.test.ts
# Expected: 5 passing tests
```

- [ ] **Step 2.5: Commit**

```bash
git add src/lib/reviewer/calibration.ts src/lib/reviewer/__tests__/calibration.test.ts
git commit -m "feat(reviewer): calibration math + unit tests"
```

---

## Task 3: Reviewer tier classifier (pure function)

**Files:**
- Create: `src/lib/reviewer/tier.ts`
- Create: `src/lib/reviewer/__tests__/tier.test.ts`

- [ ] **Step 3.1: Write the failing test**

```typescript
// src/lib/reviewer/__tests__/tier.test.ts
import { describe, it, expect } from "vitest";
import { classifyTier } from "../tier";

describe("classifyTier", () => {
  it("returns null when calibration is null", () => {
    expect(classifyTier(null, 50)).toBeNull();
  });

  it("returns null below bronze thresholds", () => {
    expect(classifyTier(60, 100)).toBeNull();   // 60% cal fails bronze 70% min
    expect(classifyTier(75, 5)).toBeNull();     // 5 reviews fails bronze 10 min
  });

  it("returns bronze when both bronze minimums met", () => {
    expect(classifyTier(70, 10)).toBe("bronze");
    expect(classifyTier(79, 29)).toBe("bronze");
  });

  it("returns silver when both silver minimums met", () => {
    expect(classifyTier(80, 30)).toBe("silver");
    expect(classifyTier(84, 74)).toBe("silver");
  });

  it("returns gold when both gold minimums met", () => {
    expect(classifyTier(85, 75)).toBe("gold");
    expect(classifyTier(100, 1000)).toBe("gold");
  });

  it("uses the lower tier when one threshold is met but not both", () => {
    expect(classifyTier(85, 30)).toBe("silver");  // high cal, silver review count
    expect(classifyTier(72, 75)).toBe("bronze");  // many reviews, bronze cal
  });
});
```

- [ ] **Step 3.2: Run and verify failure**

```bash
npm run test -- src/lib/reviewer/__tests__/tier.test.ts
# Expected: FAIL — cannot find module "../tier"
```

- [ ] **Step 3.3: Implement minimal tier classifier**

```typescript
// src/lib/reviewer/tier.ts
export type ReviewerTier = "bronze" | "silver" | "gold";

export const TIER_THRESHOLDS = {
  bronze: { minReviews: 10, minCalibration: 70 },
  silver: { minReviews: 30, minCalibration: 80 },
  gold:   { minReviews: 75, minCalibration: 85 },
} as const;

/**
 * Returns the highest tier whose BOTH thresholds (minReviews and minCalibration)
 * are met by the reviewer. Returns null below bronze.
 */
export function classifyTier(
  calibration: number | null,
  reviewCount: number,
): ReviewerTier | null {
  if (calibration == null) return null;

  if (
    reviewCount >= TIER_THRESHOLDS.gold.minReviews &&
    calibration >= TIER_THRESHOLDS.gold.minCalibration
  ) return "gold";

  if (
    reviewCount >= TIER_THRESHOLDS.silver.minReviews &&
    calibration >= TIER_THRESHOLDS.silver.minCalibration
  ) return "silver";

  if (
    reviewCount >= TIER_THRESHOLDS.bronze.minReviews &&
    calibration >= TIER_THRESHOLDS.bronze.minCalibration
  ) return "bronze";

  return null;
}
```

- [ ] **Step 3.4: Run and verify pass**

```bash
npm run test -- src/lib/reviewer/__tests__/tier.test.ts
# Expected: 6 passing tests
```

- [ ] **Step 3.5: Commit**

```bash
git add src/lib/reviewer/tier.ts src/lib/reviewer/__tests__/tier.test.ts
git commit -m "feat(reviewer): tier classifier + thresholds"
```

---

## Task 4: Reviewer calibration cron job

**Files:**
- Create: `src/lib/cron-jobs/reviewer-calibration.ts`

- [ ] **Step 4.1: Implement the cron logic**

```typescript
// src/lib/cron-jobs/reviewer-calibration.ts
import { createAdminClient } from "@/lib/supabase/admin";
import { computeCalibration, MIN_REVIEWS_FOR_CALIBRATION } from "@/lib/reviewer/calibration";
import { classifyTier } from "@/lib/reviewer/tier";

/**
 * Nightly: recompute reviewer_calibration + reviewer_tier for every user
 * who has authored >= MIN_REVIEWS_FOR_CALIBRATION reviews with reviewer_user_id set.
 *
 * Anonymous reviews (reviewer_user_id IS NULL) are skipped.
 */
export async function runReviewerCalibration(): Promise<{ updated: number; skipped: number }> {
  const sb = createAdminClient();

  // 1. Pull all reviews with a logged-in reviewer + the builder's vibe_score.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rows, error } = await (sb as any)
    .from("reviews")
    .select("reviewer_user_id, rating, builder:users!builder_id ( vibe_score )")
    .not("reviewer_user_id", "is", null);

  if (error) {
    console.error("reviewer-calibration: fetch failed", error);
    return { updated: 0, skipped: 0 };
  }

  // 2. Pull the global vibe_score distribution to compute percentile.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: allScores } = await (sb as any)
    .from("users")
    .select("vibe_score")
    .gt("vibe_score", 0)
    .order("vibe_score", { ascending: true });

  const scores: number[] = (allScores || []).map((u: { vibe_score: number }) => u.vibe_score);
  const total = scores.length || 1;

  // Percentile: fraction of users with score STRICTLY LESS than this one.
  function percentileFor(score: number): number {
    let count = 0;
    for (const s of scores) {
      if (s < score) count++;
      else break;
    }
    return count / total;
  }

  // 3. Group reviews by reviewer.
  const grouped = new Map<string, Array<{ rating: number; builderPercentile: number }>>();
  for (const r of rows || []) {
    const uid = r.reviewer_user_id as string;
    const builderScore = (r.builder as { vibe_score: number } | null)?.vibe_score ?? 0;
    const list = grouped.get(uid) || [];
    list.push({ rating: r.rating, builderPercentile: percentileFor(builderScore) });
    grouped.set(uid, list);
  }

  // 4. Compute + upsert per reviewer.
  let updated = 0;
  let skipped = 0;

  for (const [reviewerUserId, reviews] of grouped) {
    if (reviews.length < MIN_REVIEWS_FOR_CALIBRATION) { skipped++; continue; }
    const cal = computeCalibration(reviews);
    const tier = classifyTier(cal, reviews.length);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updErr } = await (sb as any)
      .from("users")
      .update({ reviewer_calibration: cal, reviewer_tier: tier })
      .eq("id", reviewerUserId);

    if (updErr) {
      console.error("reviewer-calibration: update failed", reviewerUserId, updErr);
      continue;
    }
    updated++;
  }

  return { updated, skipped };
}
```

- [ ] **Step 4.2: Manual smoke test against local Supabase**

```bash
# 1. Seed: log into Supabase, insert 5 fake reviews for one user as reviewer_user_id.
# 2. Run the cron via a one-off script or curl the daily cron locally:
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/daily
# Expected: response includes calibration: { updated: N, skipped: M }
```

- [ ] **Step 4.3: Commit**

```bash
git add src/lib/cron-jobs/reviewer-calibration.ts
git commit -m "feat(reviewer): nightly calibration cron job"
```

---

## Task 5: Wire calibration into daily cron route

**Files:**
- Modify: `src/app/api/cron/daily/route.ts`

- [ ] **Step 5.1: Read the existing daily cron route**

```bash
cat src/app/api/cron/daily/route.ts
# Note the exact import + invocation pattern used by other cron logic.
```

- [ ] **Step 5.2: Add reviewer-calibration to the daily handler**

In `src/app/api/cron/daily/route.ts`, import and invoke `runReviewerCalibration`:

```typescript
import { runReviewerCalibration } from "@/lib/cron-jobs/reviewer-calibration";

// Inside the existing GET handler, after the existing daily work:
const reviewerCal = await runReviewerCalibration();
results.reviewerCalibration = reviewerCal;
```

(Adjust `results` shape to match whatever the existing handler returns.)

- [ ] **Step 5.3: Smoke test**

```bash
npm run dev
# In a second terminal:
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/daily
# Expected: 200 OK with reviewerCalibration in response body
```

- [ ] **Step 5.4: Commit**

```bash
git add src/app/api/cron/daily/route.ts
git commit -m "feat(reviewer): wire calibration into daily cron"
```

---

## Task 6: ReviewerStats profile section (component)

**Files:**
- Create: `src/components/profile/reviewer-stats.tsx`

- [ ] **Step 6.1: Implement the component**

```tsx
// src/components/profile/reviewer-stats.tsx
import { TIER_THRESHOLDS, type ReviewerTier } from "@/lib/reviewer/tier";

interface ReviewerStatsProps {
  reviewsGiven: number;          // count of reviews where reviewer_user_id = this user
  reviewsLast30d: number;        // subset
  calibration: number | null;    // 0-100 or null
  tier: ReviewerTier | null;
}

const TIER_STYLES: Record<ReviewerTier, { bg: string; label: string }> = {
  bronze: { bg: "bg-[#D97706]", label: "BRONZE" },
  silver: { bg: "bg-[#71717A]", label: "SILVER" },
  gold:   { bg: "bg-[#CA8A04]", label: "GOLD" },
};

export function ReviewerStats({ reviewsGiven, reviewsLast30d, calibration, tier }: ReviewerStatsProps) {
  // Hide block entirely if user has never reviewed anyone — keeps non-reviewer profiles clean.
  if (reviewsGiven === 0) return null;

  return (
    <section
      className="bg-[var(--bg-surface)] border-2 border-[var(--border-hard)] p-4 sm:p-5 rounded"
      style={{ boxShadow: "var(--shadow-brutal-sm)" }}
      aria-labelledby="reviewer-stats-heading"
    >
      <header className="flex items-center justify-between pb-3 mb-4 border-b-2 border-dashed border-[var(--border-subtle)]">
        <h3 id="reviewer-stats-heading" className="text-[15px] font-extrabold uppercase tracking-wider text-[var(--text-secondary)]">
          Reviewer
        </h3>
        {tier && (
          <span
            className={`${TIER_STYLES[tier].bg} text-white px-3 py-1 text-[11px] font-extrabold tracking-wide rounded-full border-2 border-[var(--border-hard)]`}
          >
            {TIER_STYLES[tier].label}
          </span>
        )}
      </header>

      <div className="grid grid-cols-2 gap-3">
        <Stat number={reviewsGiven.toString()} label="REVIEWS GIVEN" tooltip={`${reviewsLast30d} in last 30d`} />
        <Stat
          number={calibration != null ? `${Math.round(calibration)}%` : "—"}
          label="CALIBRATION"
          tooltip={calibration != null ? "stars vs builder rank" : `need ${TIER_THRESHOLDS.bronze.minReviews - reviewsGiven} more reviews`}
        />
      </div>
    </section>
  );
}

function Stat({ number, label, tooltip }: { number: string; label: string; tooltip: string }) {
  return (
    <div className="bg-[var(--background)] border-2 border-[var(--border-hard)] p-3 rounded">
      <div className="font-mono font-black text-[22px] leading-none text-[var(--accent)]">{number}</div>
      <div className="text-[11px] font-extrabold tracking-widest text-[var(--text-secondary)] mt-1">{label}</div>
      <div className="text-[10px] font-mono text-[var(--text-muted)] mt-1">{tooltip}</div>
    </div>
  );
}
```

- [ ] **Step 6.2: Visually inspect on dev server**

```bash
npm run dev
# Visit a profile page; if ReviewerStats isn't wired yet, write a temporary preview at
# src/app/dev/reviewer-stats/page.tsx that imports + renders it with mock props.
```

- [ ] **Step 6.3: Commit**

```bash
git add src/components/profile/reviewer-stats.tsx
git commit -m "feat(reviewer): ReviewerStats profile section component"
```

---

## Task 7: ReviewerByline inline component

**Files:**
- Create: `src/components/reviews/reviewer-byline.tsx`

- [ ] **Step 7.1: Implement**

```tsx
// src/components/reviews/reviewer-byline.tsx
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
  // Anonymous reviewer — no reputation data to show.
  if (!reviewerUsername || reviewsGiven == null || reviewsGiven === 0) {
    return (
      <div className="text-[13px] text-[var(--text-secondary)]">
        reviewed by <b className="text-[var(--foreground)]">{reviewerName}</b>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap text-[13px] text-[var(--text-secondary)]">
      <span>reviewed by <b className="text-[var(--foreground)]">@{reviewerUsername}</b></span>
      <span className="font-mono">
        · {reviewsGiven} reviews
        {calibration != null && ` · ${Math.round(calibration)}% cal`}
      </span>
      {tier && (
        <span className={`${TIER_STYLES[tier]} text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-sm tracking-wider`}>
          {tier.toUpperCase()}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 7.2: Commit**

```bash
git add src/components/reviews/reviewer-byline.tsx
git commit -m "feat(reviewer): ReviewerByline inline component"
```

---

## Task 8: Modify POST /api/reviews to set reviewer_user_id

**Files:**
- Modify: `src/app/api/reviews/route.ts`

- [ ] **Step 8.1: Read current POST handler**

```bash
cat src/app/api/reviews/route.ts
# Find the POST function. Locate where the insert payload is built.
```

- [ ] **Step 8.2: Add logged-in-user detection**

In the POST handler, before the insert:

```typescript
import { getCurrentUserId } from "@/lib/supabase/server";  // or whatever helper exists

// Inside POST, just before the insert:
const reviewerUserId = await getCurrentUserId(req).catch(() => null);

// Then in the insert payload:
const insertPayload = {
  // ...existing fields,
  reviewer_user_id: reviewerUserId,   // null when anonymous
};
```

If no `getCurrentUserId` helper exists, derive from Privy session cookie or whatever pattern other authenticated routes use (e.g., `/api/projects/verify`). **Do not invent a new auth pattern** — match the existing one.

- [ ] **Step 8.3: Smoke test both paths**

```bash
npm run dev
# 1. Submit a review while logged out — confirm reviewer_user_id IS NULL in DB
# 2. Submit a review while logged in as user X — confirm reviewer_user_id = X.id in DB
```

- [ ] **Step 8.4: Commit**

```bash
git add src/app/api/reviews/route.ts
git commit -m "feat(reviewer): link reviews to authenticated reviewer_user_id"
```

---

## Task 9: Weekly snapshot cron job

**Files:**
- Create: `src/lib/cron-jobs/weekly-snapshot.ts`

- [ ] **Step 9.1: Implement**

```typescript
// src/lib/cron-jobs/weekly-snapshot.ts
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Writes one snapshot row per active user for this Monday's week_start.
 * Idempotent: PRIMARY KEY (user_id, week_start) means re-running the same day overwrites
 * via ON CONFLICT.
 */
export async function runWeeklySnapshot(now: Date = new Date()): Promise<{ inserted: number }> {
  const sb = createAdminClient();

  const weekStart = mondayOf(now);
  const weekStartStr = weekStart.toISOString().slice(0, 10);

  // Pull all users with score > 0, ranked.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: users, error } = await (sb as any)
    .from("users")
    .select("id, vibe_score")
    .gt("vibe_score", 0)
    .order("vibe_score", { ascending: false });

  if (error || !users) {
    console.error("weekly-snapshot: fetch failed", error);
    return { inserted: 0 };
  }

  const rows = users.map((u: { id: string; vibe_score: number }, idx: number) => ({
    user_id: u.id,
    week_start: weekStartStr,
    vibe_score: u.vibe_score,
    rank: idx + 1,
    // commits_7d: intentionally left at 0 for v1. Spec §13 defers per-snapshot commit
    // aggregation to post-hackathon. The cards already surface commits_7d from the
    // projects table (Task 24), so the leaderboard receipt doesn't need it yet.
    commits_7d: 0,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insErr, count } = await (sb as any)
    .from("vibe_score_weekly_snapshots")
    .upsert(rows, { onConflict: "user_id,week_start", count: "exact" });

  if (insErr) {
    console.error("weekly-snapshot: upsert failed", insErr);
    return { inserted: 0 };
  }
  return { inserted: count ?? rows.length };
}

/** Returns the Monday on or before `d` at UTC midnight. */
function mondayOf(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = x.getUTCDay();              // 0=Sun..6=Sat
  const diff = day === 0 ? 6 : day - 1;
  x.setUTCDate(x.getUTCDate() - diff);
  return x;
}
```

- [ ] **Step 9.2: Write a date-helper test (sanity)**

```typescript
// src/lib/cron-jobs/__tests__/weekly-snapshot.test.ts
import { describe, it, expect } from "vitest";
// Re-export mondayOf for tests:
//   in weekly-snapshot.ts add `export { mondayOf };`
import { mondayOf } from "../weekly-snapshot";

describe("mondayOf", () => {
  it("returns the same day when given a Monday", () => {
    const mon = new Date("2026-05-11T15:00:00Z");      // a Monday
    expect(mondayOf(mon).toISOString().slice(0, 10)).toBe("2026-05-11");
  });
  it("returns the previous Monday when given a Sunday", () => {
    const sun = new Date("2026-05-10T15:00:00Z");
    expect(mondayOf(sun).toISOString().slice(0, 10)).toBe("2026-05-04");
  });
  it("returns the previous Monday when given a Wednesday", () => {
    const wed = new Date("2026-05-13T15:00:00Z");
    expect(mondayOf(wed).toISOString().slice(0, 10)).toBe("2026-05-11");
  });
});
```

Also export `mondayOf`:

```typescript
// at bottom of weekly-snapshot.ts
export { mondayOf };
```

- [ ] **Step 9.3: Run tests**

```bash
npm run test -- src/lib/cron-jobs/__tests__/weekly-snapshot.test.ts
# Expected: 3 passing tests
```

- [ ] **Step 9.4: Commit**

```bash
git add src/lib/cron-jobs/weekly-snapshot.ts src/lib/cron-jobs/__tests__/weekly-snapshot.test.ts
git commit -m "feat(leaderboard): weekly snapshot cron job"
```

---

## Task 10: Wire weekly snapshot into quality-rescore cron

**Files:**
- Modify: `src/app/api/cron/quality-rescore/route.ts` *or* `src/lib/cron-jobs/quality-rescore.ts` (whichever holds the orchestration)

- [ ] **Step 10.1: Inspect current quality-rescore flow**

```bash
cat src/app/api/cron/quality-rescore/route.ts
```

- [ ] **Step 10.2: Add Monday-only branch**

After the existing quality-rescore work in that route:

```typescript
import { runWeeklySnapshot, mondayOf } from "@/lib/cron-jobs/weekly-snapshot";

// After existing work in the GET handler:
const today = new Date();
const isMondayUTC = today.getUTCDay() === 1;
if (isMondayUTC) {
  const snapshot = await runWeeklySnapshot(today);
  results.weeklySnapshot = snapshot;
}
```

- [ ] **Step 10.3: Smoke test (force-run)**

```bash
# Temporarily comment the `isMondayUTC` guard, then:
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/quality-rescore
# Confirm: rows appear in vibe_score_weekly_snapshots for today's Monday week_start.
# Restore the guard before committing.
```

- [ ] **Step 10.4: Commit**

```bash
git add src/app/api/cron/quality-rescore/route.ts
git commit -m "feat(leaderboard): write Monday snapshot from quality-rescore cron"
```

---

## Task 11: Weekly climbers query library

**Files:**
- Create: `src/lib/leaderboard/weekly.ts`
- Create: `src/lib/leaderboard/__tests__/weekly.test.ts`

- [ ] **Step 11.1: Write the failing test for delta math**

```typescript
// src/lib/leaderboard/__tests__/weekly.test.ts
import { describe, it, expect } from "vitest";
import { computeClimbers, MIN_VIBE_FLOOR } from "../weekly";

describe("computeClimbers", () => {
  it("sorts by rank-position climb desc", () => {
    const snapshots = [
      { user_id: "a", rank: 80, vibe_score: 200 },
      { user_id: "b", rank: 50, vibe_score: 775 },
      { user_id: "c", rank: 15, vibe_score: 750 },
    ];
    const current = [
      { id: "a", username: "maya", vibe_score: 280, rank: 38, avatar_url: null },
      { id: "b", username: "abhi", vibe_score: 847, rank: 38, avatar_url: null },
      { id: "c", username: "kai",  vibe_score: 850, rank: 8,  avatar_url: null },
    ];
    const result = computeClimbers(snapshots, current);
    expect(result.map((r) => r.username)).toEqual(["maya", "abhi", "kai"]);
    // maya: ▲42, abhi: ▲12, kai: ▲7
    expect(result[0].rankClimb).toBe(42);
    expect(result[0].scoreDelta).toBe(80);
  });

  it("filters out users below the vibe_score floor", () => {
    const snapshots = [
      { user_id: "n", rank: 999, vibe_score: 5 },
    ];
    const current = [
      { id: "n", username: "newbie", vibe_score: 50, rank: 200, avatar_url: null },
    ];
    expect(computeClimbers(snapshots, current)).toEqual([]);
    expect(MIN_VIBE_FLOOR).toBe(100);
  });

  it("includes users with no prior snapshot but marks rankClimb as null", () => {
    const snapshots: Array<{ user_id: string; rank: number; vibe_score: number }> = [];
    const current = [
      { id: "x", username: "fresh", vibe_score: 150, rank: 60, avatar_url: null },
    ];
    const result = computeClimbers(snapshots, current);
    expect(result).toHaveLength(1);
    expect(result[0].rankClimb).toBeNull();
    expect(result[0].scoreDelta).toBeNull();
  });
});
```

- [ ] **Step 11.2: Run, verify failure**

```bash
npm run test -- src/lib/leaderboard/__tests__/weekly.test.ts
# Expected: FAIL — cannot find module "../weekly"
```

- [ ] **Step 11.3: Implement**

```typescript
// src/lib/leaderboard/weekly.ts
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
```

- [ ] **Step 11.4: Run, verify pass**

```bash
npm run test -- src/lib/leaderboard/__tests__/weekly.test.ts
# Expected: 3 passing tests
```

- [ ] **Step 11.5: Commit**

```bash
git add src/lib/leaderboard/weekly.ts src/lib/leaderboard/__tests__/weekly.test.ts
git commit -m "feat(leaderboard): weekly climbers query + delta math"
```

---

## Task 12: Extend /api/leaderboard with ?range=week

**Files:**
- Modify: `src/app/api/leaderboard/route.ts`

- [ ] **Step 12.1: Add range param handling**

After existing parsing in the GET handler:

```typescript
import { computeClimbers, MIN_VIBE_FLOOR } from "@/lib/leaderboard/weekly";
import { mondayOf } from "@/lib/cron-jobs/weekly-snapshot";

// Inside GET, near the top:
const range = request.nextUrl.searchParams.get("range") || "all";

if (range === "week") {
  const monday = mondayOf(new Date()).toISOString().slice(0, 10);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: snapshots } = await (sb as any)
    .from("vibe_score_weekly_snapshots")
    .select("user_id, rank, vibe_score")
    .eq("week_start", monday);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: current } = await (sb as any)
    .from("users")
    .select("id, username, avatar_url, vibe_score")
    .not("username", "is", null)
    .gte("vibe_score", MIN_VIBE_FLOOR)
    .order("vibe_score", { ascending: false });

  // Compute live ranks
  const ranked = (current ?? []).map((u: { id: string; username: string; avatar_url: string | null; vibe_score: number }, i: number) => ({ ...u, rank: i + 1 }));

  const climbers = computeClimbers(snapshots ?? [], ranked).slice(0, limit);

  return NextResponse.json(
    { leaderboard: climbers, range: "week", week_start: monday },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } },
  );
}

// Otherwise fall through to existing all-time logic.
```

- [ ] **Step 12.2: Smoke test**

```bash
npm run dev
curl http://localhost:3000/api/leaderboard?range=week | jq .
# Expected: { leaderboard: [...], range: "week", week_start: "YYYY-MM-DD" }
```

- [ ] **Step 12.3: Commit**

```bash
git add src/app/api/leaderboard/route.ts
git commit -m "feat(leaderboard): GET /api/leaderboard?range=week"
```

---

## Task 13: LeaderboardRow (B-refined) component

**Files:**
- Create: `src/components/leaderboard/row.tsx`

- [ ] **Step 13.1: Implement**

```tsx
// src/components/leaderboard/row.tsx
import Link from "next/link";
import Image from "next/image";

export interface LeaderboardRowProps {
  position: number;             // visual 1-indexed position
  username: string;
  avatarUrl: string | null;
  currentRank: number;
  previousRank: number | null;
  rankClimb: number | null;     // null = no prior data
  currentScore: number;
  scoreDelta: number | null;
  isCrown?: boolean;
}

export function LeaderboardRow(p: LeaderboardRowProps) {
  return (
    <Link
      href={`/profile/${p.username}`}
      className={`grid items-center gap-5 px-5 py-4 border-b border-[var(--border-subtle)] last:border-b-0 hover:bg-[var(--bg-surface-light)] transition-colors ${p.isCrown ? "bg-[#FFF7ED] dark:bg-[var(--bg-surface-light)] border-b-[var(--border-hard)]" : ""}`}
      style={{ gridTemplateColumns: "44px 48px 1fr auto auto" }}
    >
      <span className="font-mono text-[15px] font-extrabold text-[var(--text-secondary)]">
        {String(p.position).padStart(2, "0")}
      </span>

      {p.avatarUrl ? (
        <Image src={p.avatarUrl} alt={p.username} width={48} height={48} className="rounded-full border-2 border-[var(--border-hard)]" />
      ) : (
        <div
          className="w-12 h-12 rounded-full border-2 border-[var(--border-hard)] flex items-center justify-center text-white font-extrabold text-[17px]"
          style={{ background: "linear-gradient(135deg, var(--accent), #FFA07A)" }}
        >
          {p.username[0]?.toUpperCase()}
        </div>
      )}

      <div>
        <div className="font-bold text-[16px] text-[var(--foreground)] leading-tight">@{p.username}</div>
        <div className="text-[13px] font-mono text-[var(--text-tertiary)] mt-1">
          rank #{p.currentRank}
          {p.previousRank != null && ` · was #${p.previousRank}`}
        </div>
      </div>

      <div className="text-right min-w-[70px]">
        {p.rankClimb != null ? (
          <>
            <div className="font-mono font-black text-[22px] leading-none text-[var(--accent)] tracking-tight">
              {p.rankClimb > 0 ? `▲${p.rankClimb}` : p.rankClimb === 0 ? "·" : `▼${-p.rankClimb}`}
            </div>
            <div className="text-[11px] font-extrabold uppercase tracking-widest text-[var(--text-secondary)] mt-1">
              {Math.abs(p.rankClimb) === 1 ? "SPOT" : "SPOTS"}
            </div>
          </>
        ) : (
          <div className="text-[13px] font-mono text-[var(--text-muted)]">—</div>
        )}
      </div>

      <div className="text-right min-w-[70px]">
        <div className="font-mono font-extrabold text-[22px] leading-none text-[var(--foreground)]">{p.currentScore}</div>
        {p.scoreDelta != null && (
          <div className="text-[13px] font-extrabold font-mono text-[var(--accent)] mt-1">
            {p.scoreDelta >= 0 ? `+${p.scoreDelta}` : `${p.scoreDelta}`}
          </div>
        )}
      </div>
    </Link>
  );
}
```

- [ ] **Step 13.2: Commit**

```bash
git add src/components/leaderboard/row.tsx
git commit -m "feat(leaderboard): B-refined LeaderboardRow component"
```

---

## Task 14: WeeklyTab + AllTimeTab + tabbed wrapper

**Files:**
- Create: `src/components/leaderboard/weekly-tab.tsx`
- Create: `src/components/leaderboard/all-time-tab.tsx`
- Modify: `src/components/leaderboard/leaderboard-content.tsx`

- [ ] **Step 14.1: WeeklyTab (fetches and renders rows)**

```tsx
// src/components/leaderboard/weekly-tab.tsx
"use client";

import { useEffect, useState } from "react";
import { LeaderboardRow, type LeaderboardRowProps } from "./row";

export function WeeklyTab() {
  const [rows, setRows] = useState<LeaderboardRowProps[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/leaderboard?range=week&limit=50");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (cancelled) return;
        const props: LeaderboardRowProps[] = (json.leaderboard ?? []).map(
          (r: {
            username: string;
            avatar_url: string | null;
            currentRank: number;
            previousRank: number | null;
            rankClimb: number | null;
            currentScore: number;
            scoreDelta: number | null;
          }, idx: number) => ({
            position: idx + 1,
            username: r.username,
            avatarUrl: r.avatar_url,
            currentRank: r.currentRank,
            previousRank: r.previousRank,
            rankClimb: r.rankClimb,
            currentScore: r.currentScore,
            scoreDelta: r.scoreDelta,
            isCrown: idx === 0,
          }),
        );
        setRows(props);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (error) {
    return (
      <div className="text-[13px] text-[var(--status-error-text)] bg-[var(--status-error-bg)] border border-[var(--status-error-border)] p-4 rounded">
        Couldn't load weekly leaderboard ({error}).
      </div>
    );
  }
  if (rows == null) {
    return <div className="text-[13px] text-[var(--text-muted)] p-4">Loading…</div>;
  }
  if (rows.length === 0) {
    return <div className="text-[13px] text-[var(--text-muted)] p-4">No climbers this week yet. Check back Monday.</div>;
  }

  return (
    <div className="bg-[var(--bg-surface)] border-2 border-[var(--border-hard)] rounded overflow-hidden" style={{ boxShadow: "var(--shadow-brutal)" }}>
      <header className="bg-[var(--bg-inverted)] text-[var(--text-on-inverted)] px-5 py-4 flex justify-between items-center">
        <h3 className="text-[15px] font-extrabold tracking-wider">LEADERBOARD</h3>
        <span className="bg-[var(--accent)] text-white px-3 py-1 text-[12px] font-extrabold rounded-sm">THIS WEEK ▲</span>
      </header>
      <div>
        {rows.map((r) => <LeaderboardRow key={r.username} {...r} />)}
      </div>
    </div>
  );
}
```

- [ ] **Step 14.2: AllTimeTab — wrap existing LeaderboardContent body**

```tsx
// src/components/leaderboard/all-time-tab.tsx
"use client";

import { LeaderboardContent } from "./leaderboard-content";
import type { UserWithSocials } from "@/lib/types/database";

export function AllTimeTab({ users }: { users: UserWithSocials[] }) {
  return <LeaderboardContent users={users} />;
}
```

- [ ] **Step 14.3: Add tabbed wrapper in leaderboard-content.tsx**

The cleanest move: keep `LeaderboardContent` as-is and create a NEW client component `LeaderboardTabs` at `src/components/leaderboard/leaderboard-tabs.tsx`. Switch `src/app/leaderboard/page.tsx` to render `LeaderboardTabs` instead of `LeaderboardContent` directly.

```tsx
// src/components/leaderboard/leaderboard-tabs.tsx
"use client";

import { useState } from "react";
import { WeeklyTab } from "./weekly-tab";
import { AllTimeTab } from "./all-time-tab";
import type { UserWithSocials } from "@/lib/types/database";

type Tab = "week" | "all";

export function LeaderboardTabs({ users }: { users: UserWithSocials[] }) {
  const [tab, setTab] = useState<Tab>("week");

  return (
    <div>
      <div className="flex border-2 border-[var(--border-hard)] mb-4" role="tablist" aria-label="Leaderboard range">
        <button
          role="tab"
          aria-selected={tab === "week"}
          onClick={() => setTab("week")}
          className={`flex-1 py-3 px-4 text-[14px] font-bold border-r-2 border-[var(--border-hard)] ${tab === "week" ? "bg-[var(--accent)] text-white" : "bg-[var(--bg-surface)] text-[var(--foreground)]"}`}
        >
          This week ▲
        </button>
        <button
          role="tab"
          aria-selected={tab === "all"}
          onClick={() => setTab("all")}
          className={`flex-1 py-3 px-4 text-[14px] font-bold ${tab === "all" ? "bg-[var(--accent)] text-white" : "bg-[var(--bg-surface)] text-[var(--foreground)]"}`}
        >
          All-time
        </button>
      </div>

      {tab === "week" ? <WeeklyTab /> : <AllTimeTab users={users} />}
    </div>
  );
}
```

- [ ] **Step 14.4: Modify src/app/leaderboard/page.tsx**

Replace the existing `<LeaderboardContent users={users} />` with `<LeaderboardTabs users={users} />` and update the import.

- [ ] **Step 14.5: Visually verify on dev server**

```bash
npm run dev
# Visit http://localhost:3000/leaderboard
# Confirm: both tabs render, weekly tab fetches /api/leaderboard?range=week, all-time still works.
```

- [ ] **Step 14.6: Commit**

```bash
git add src/components/leaderboard/weekly-tab.tsx src/components/leaderboard/all-time-tab.tsx src/components/leaderboard/leaderboard-tabs.tsx src/app/leaderboard/page.tsx
git commit -m "feat(leaderboard): WeeklyTab + AllTimeTab + tabbed wrapper"
```

---

## Task 15: Brutalist Poster OG image (profile share card)

**Files:**
- Modify: `src/app/profile/[username]/opengraph-image.tsx` (replace existing render)

- [ ] **Step 15.1: Read existing opengraph-image.tsx for the data-fetch pattern**

```bash
cat src/app/profile/\[username\]/opengraph-image.tsx
# Keep the user-not-found fallback, runtime export, and size export. Only replace the JSX.
```

- [ ] **Step 15.2: Implement the Brutalist Poster**

Replace the existing JSX (the user-found branch) with:

```tsx
return new ImageResponse(
  (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#EAEBEA",
        backgroundImage: "radial-gradient(rgba(0,0,0,0.06) 2px, transparent 2px)",
        backgroundSize: "20px 20px",
        padding: "60px 80px",
        gap: "60px",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ position: "absolute", top: "32px", right: "60px", fontSize: 14, fontWeight: 900, letterSpacing: "0.12em", color: "#0F0F0F" }}>
        VIBE<span style={{ color: "#FF3A00" }}>TALENT</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: "0.2em", color: "#0F0F0F" }}>VIBE SCORE</div>
        <div style={{ fontSize: 220, fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 0.9, color: "#FF3A00", textShadow: "4px 4px 0 #0F0F0F" }}>
          {user.vibe_score}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 30, alignItems: "center" }}>
          <span style={{ background: "#0F0F0F", color: "#fff", padding: "8px 16px", fontSize: 22, fontWeight: 800, borderRadius: 4 }}>
            @{user.username}
          </span>
          <span style={{ background: "#FF3A00", color: "#fff", padding: "6px 12px", fontSize: 18, fontWeight: 800, border: "2px solid #0F0F0F", borderRadius: 2 }}>
            🔥 streak {user.streak ?? 0}d
          </span>
        </div>
      </div>

      <div style={{
        background: "#fff", border: "3px solid #0F0F0F", boxShadow: "8px 8px 0 #0F0F0F",
        padding: 24, display: "flex", flexDirection: "column", gap: 10, minWidth: 280, borderRadius: 4,
      }}>
        <StatLine label="badge" value={(user.badge_level ?? "none").toUpperCase()} />
        <StatLine label="longest streak" value={`${user.longest_streak ?? 0}d`} />
        <StatLine label="projects" value={String(user.project_count ?? 0)} />
      </div>
    </div>
  ),
  { ...size },
);

function StatLine({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 18, color: "#0F0F0F" }}>
      <span style={{ fontFamily: "ui-monospace, Menlo, monospace", color: "#52525B" }}>{label}</span>
      <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontWeight: 800, color: "#FF3A00", fontSize: 22 }}>{value}</span>
    </div>
  );
}
```

If `user.project_count` isn't on `fetchUserByUsernameCached`'s return type, add a separate query or fall back to `0` — do not break the existing fetch.

- [ ] **Step 15.3: Visual smoke test**

```bash
npm run dev
# Visit:
open "http://localhost:3000/profile/<any-username>/opengraph-image"
# Confirm: 1200×630 image renders the Brutalist Poster, fonts render (no boxes), no error in dev console.
```

- [ ] **Step 15.4: Commit**

```bash
git add src/app/profile/\[username\]/opengraph-image.tsx
git commit -m "feat(og): Brutalist Poster profile share card"
```

---

## Task 16: Receipt Stub OG image route

**Files:**
- Create: `src/app/api/og/receipt/[type]/[username]/route.tsx`

- [ ] **Step 16.1: Implement**

```tsx
// src/app/api/og/receipt/[type]/[username]/route.tsx
import { ImageResponse } from "next/og";
import { fetchUserByUsernameCached } from "@/lib/supabase/server-queries";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type ReceiptType = "weekly" | "shipped" | "custom";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ type: string; username: string }> },
) {
  const { type, username } = await ctx.params;
  const validType = (["weekly", "shipped", "custom"] as const).includes(type as ReceiptType) ? (type as ReceiptType) : "weekly";

  const user = await fetchUserByUsernameCached(username);
  if (!user) {
    return new Response("Not Found", { status: 404 });
  }

  const lines = buildLines(validType, user);
  const headerSub = headerSubFor(validType);

  return new ImageResponse(
    (
      <div style={{
        width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
        background: "#0F0F0F", padding: 50, fontFamily: "ui-monospace, Menlo, monospace",
      }}>
        <div style={{
          background: "#fff", color: "#0F0F0F", padding: "36px 44px", width: "76%",
          boxShadow: "12px 12px 0 #FF3A00", position: "relative",
        }}>
          <div style={{ textAlign: "center", borderBottom: "3px dashed #0F0F0F", paddingBottom: 16, marginBottom: 18 }}>
            <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: "0.18em" }}>VIBETALENT · {validType.toUpperCase()}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#3F3F46", letterSpacing: "0.08em", marginTop: 6 }}>{headerSub}</div>
          </div>

          {lines.map(({ label, value, highlight }) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 22, padding: "4px 0", letterSpacing: "0.02em" }}>
              <span>{label}</span>
              <span style={{ fontWeight: 800, color: highlight ? "#FF3A00" : "#0F0F0F" }}>{value}</span>
            </div>
          ))}

          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "3px dashed #0F0F0F", display: "flex", justifyContent: "space-between", fontSize: 24, fontWeight: 800 }}>
            <span>VIBE_SCORE</span>
            <span style={{ color: "#FF3A00", fontSize: 28 }}>{user.vibe_score}</span>
          </div>

          <div style={{ display: "flex", gap: 2, justifyContent: "center", marginTop: 16 }}>
            {Array.from({ length: 32 }).map((_, i) => (
              <div key={i} style={{
                width: i % 3 === 0 ? 4 : 2,
                height: i % 2 === 0 ? 28 : 22,
                background: "#0F0F0F",
              }} />
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: 12, fontSize: 14, color: "#3F3F46", letterSpacing: "0.18em", fontWeight: 700 }}>
            — THANK YOU FOR SHIPPING —
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}

function buildLines(type: ReceiptType, user: { username: string; longest_streak?: number; streak?: number }): Array<{ label: string; value: string; highlight?: boolean }> {
  // For v1, just username + streak + longest. Receipt detail (commits, rank delta) gets
  // wired in Task 17 when we add /api/receipt/[username]/weekly.
  return [
    { label: "USER", value: `@${user.username}` },
    { label: "STREAK", value: `${user.streak ?? 0} days` },
    { label: "LONGEST", value: `${user.longest_streak ?? 0} days` },
  ];
}

function headerSubFor(type: ReceiptType): string {
  if (type === "weekly")  return "WEEKLY RECEIPT";
  if (type === "shipped") return "PROJECT SHIPPED";
  return "SHARED FROM PROFILE";
}
```

- [ ] **Step 16.2: Visual smoke test**

```bash
npm run dev
open "http://localhost:3000/api/og/receipt/weekly/<any-username>"
open "http://localhost:3000/api/og/receipt/shipped/<any-username>"
open "http://localhost:3000/api/og/receipt/custom/<any-username>"
# Confirm: each renders with appropriate header sub-line.
```

- [ ] **Step 16.3: Commit**

```bash
git add src/app/api/og/receipt
git commit -m "feat(receipt): Receipt Stub OG image (weekly/shipped/custom)"
```

---

## Task 17: Weekly receipt JSON endpoint

**Files:**
- Create: `src/app/api/receipt/[username]/weekly/route.ts`

- [ ] **Step 17.1: Implement**

```typescript
// src/app/api/receipt/[username]/weekly/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mondayOf } from "@/lib/cron-jobs/weekly-snapshot";

export async function GET(req: NextRequest, ctx: { params: Promise<{ username: string }> }) {
  const { username } = await ctx.params;
  const weekParam = req.nextUrl.searchParams.get("week");
  // week format: YYYY-MM-DD (Monday) — defaults to current Monday
  const weekStart = weekParam ?? mondayOf(new Date()).toISOString().slice(0, 10);

  const sb = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: user } = await (sb as any)
    .from("users").select("id, username, vibe_score, streak, longest_streak").eq("username", username).single();

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: thisWeek } = await (sb as any)
    .from("vibe_score_weekly_snapshots").select("rank, vibe_score").eq("user_id", user.id).eq("week_start", weekStart).maybeSingle();

  // Previous Monday for delta
  const prevMonday = new Date(weekStart);
  prevMonday.setUTCDate(prevMonday.getUTCDate() - 7);
  const prevMondayStr = prevMonday.toISOString().slice(0, 10);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: prevWeek } = await (sb as any)
    .from("vibe_score_weekly_snapshots").select("rank, vibe_score").eq("user_id", user.id).eq("week_start", prevMondayStr).maybeSingle();

  return NextResponse.json({
    username: user.username,
    weekStart,
    vibeScore: user.vibe_score,
    scoreDelta: thisWeek && prevWeek ? thisWeek.vibe_score - prevWeek.vibe_score : null,
    rank: thisWeek?.rank ?? null,
    rankClimb: thisWeek && prevWeek ? prevWeek.rank - thisWeek.rank : null,
    streak: user.streak,
    ogImageUrl: `/api/og/receipt/weekly/${user.username}?w=${weekStart}`,
    shareUrl: `/share/${user.username}/weekly/${weekStart}`,
  }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
}
```

- [ ] **Step 17.2: Commit**

```bash
git add src/app/api/receipt
git commit -m "feat(receipt): GET /api/receipt/[username]/weekly"
```

---

## Task 18: Share landing pages (weekly + shipped + custom)

**Files:**
- Create: `src/app/share/[username]/weekly/[week]/page.tsx`
- Create: `src/app/share/[username]/shipped/[slug]/page.tsx`
- Create: `src/app/share/[username]/custom/page.tsx`
- Create: `src/components/share/share-button.tsx`

- [ ] **Step 18.1: ShareButton component**

```tsx
// src/components/share/share-button.tsx
"use client";

import { useState } from "react";

export function ShareButton({ url, text }: { url: string; text: string }) {
  const [copied, setCopied] = useState(false);
  const absUrl = typeof window !== "undefined" ? new URL(url, window.location.origin).toString() : url;

  return (
    <div className="flex gap-2 flex-wrap">
      <a
        href={`https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(absUrl)}`}
        target="_blank" rel="noopener noreferrer"
        className="bg-[var(--bg-inverted)] text-white px-4 py-2 text-[13px] font-extrabold rounded-sm hover:opacity-90"
      >Share on X →</a>
      <a
        href={`https://warpcast.com/~/compose?text=${encodeURIComponent(text)}&embeds[]=${encodeURIComponent(absUrl)}`}
        target="_blank" rel="noopener noreferrer"
        className="bg-[var(--bg-inverted)] text-white px-4 py-2 text-[13px] font-extrabold rounded-sm hover:opacity-90"
      >Cast on Farcaster →</a>
      <button
        onClick={async () => {
          await navigator.clipboard.writeText(absUrl);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="bg-[var(--accent)] text-white px-4 py-2 text-[13px] font-extrabold rounded-sm hover:opacity-90"
      >{copied ? "Copied ✓" : "Copy link"}</button>
    </div>
  );
}
```

- [ ] **Step 18.2: Weekly share page**

```tsx
// src/app/share/[username]/weekly/[week]/page.tsx
import Image from "next/image";
import { ShareButton } from "@/components/share/share-button";
import { siteUrl } from "@/lib/seo";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ username: string; week: string }> }): Promise<Metadata> {
  const { username, week } = await params;
  const og = `${siteUrl}/api/og/receipt/weekly/${username}?w=${week}`;
  return {
    title: `@${username}'s weekly receipt`,
    openGraph: { images: [{ url: og, width: 1200, height: 630 }] },
    twitter:   { card: "summary_large_image", images: [og] },
  };
}

export default async function WeeklyReceiptPage({ params }: { params: Promise<{ username: string; week: string }> }) {
  const { username, week } = await params;
  const ogImage = `/api/og/receipt/weekly/${username}?w=${week}`;
  const shareText = `My VibeTalent receipt for the week of ${week} 🧾`;
  const shareUrl = `/share/${username}/weekly/${week}`;

  return (
    <main className="max-w-[840px] mx-auto p-6">
      <h1 className="text-[28px] font-extrabold mb-1">@{username}'s receipt</h1>
      <p className="text-[14px] text-[var(--text-muted)] mb-4">Week of {week}</p>
      <div className="border-2 border-[var(--border-hard)]" style={{ boxShadow: "var(--shadow-brutal)" }}>
        <Image src={ogImage} alt="receipt" width={1200} height={630} className="w-full h-auto" />
      </div>
      <div className="mt-6">
        <ShareButton url={shareUrl} text={shareText} />
      </div>
    </main>
  );
}
```

- [ ] **Step 18.3: Shipped share page**

```tsx
// src/app/share/[username]/shipped/[slug]/page.tsx
import Image from "next/image";
import { ShareButton } from "@/components/share/share-button";
import { siteUrl } from "@/lib/seo";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ username: string; slug: string }> }): Promise<Metadata> {
  const { username, slug } = await params;
  const og = `${siteUrl}/api/og/receipt/shipped/${username}?slug=${slug}`;
  return {
    title: `@${username} shipped ${slug}`,
    openGraph: { images: [{ url: og, width: 1200, height: 630 }] },
    twitter:   { card: "summary_large_image", images: [og] },
  };
}

export default async function ShippedReceiptPage({ params }: { params: Promise<{ username: string; slug: string }> }) {
  const { username, slug } = await params;
  const ogImage = `/api/og/receipt/shipped/${username}?slug=${slug}`;
  const shareText = `Just shipped ${slug} on VibeTalent 🚀`;
  const shareUrl = `/share/${username}/shipped/${slug}`;

  return (
    <main className="max-w-[840px] mx-auto p-6">
      <h1 className="text-[28px] font-extrabold mb-1">@{username} shipped <span className="text-[var(--accent)]">{slug}</span></h1>
      <p className="text-[14px] text-[var(--text-muted)] mb-4">Project shipped & verified</p>
      <div className="border-2 border-[var(--border-hard)]" style={{ boxShadow: "var(--shadow-brutal)" }}>
        <Image src={ogImage} alt="receipt" width={1200} height={630} className="w-full h-auto" />
      </div>
      <div className="mt-6"><ShareButton url={shareUrl} text={shareText} /></div>
    </main>
  );
}
```

- [ ] **Step 18.4: Custom share page**

```tsx
// src/app/share/[username]/custom/page.tsx
import Image from "next/image";
import { ShareButton } from "@/components/share/share-button";
import { siteUrl } from "@/lib/seo";
import type { Metadata } from "next";

type Range = "7d" | "30d" | "all";

function normalizeRange(v: string | string[] | undefined): Range {
  const s = Array.isArray(v) ? v[0] : v;
  return s === "7d" || s === "all" ? s : "30d";
}

export async function generateMetadata({ params, searchParams }: { params: Promise<{ username: string }>; searchParams: Promise<{ range?: string }> }): Promise<Metadata> {
  const { username } = await params;
  const { range } = await searchParams;
  const r = normalizeRange(range);
  const og = `${siteUrl}/api/og/receipt/custom/${username}?range=${r}`;
  return {
    title: `@${username} on VibeTalent`,
    openGraph: { images: [{ url: og, width: 1200, height: 630 }] },
    twitter:   { card: "summary_large_image", images: [og] },
  };
}

export default async function CustomReceiptPage({ params, searchParams }: { params: Promise<{ username: string }>; searchParams: Promise<{ range?: string }> }) {
  const { username } = await params;
  const { range } = await searchParams;
  const r = normalizeRange(range);
  const ogImage = `/api/og/receipt/custom/${username}?range=${r}`;
  const shareText = `Check out @${username} on VibeTalent`;
  const shareUrl = `/share/${username}/custom?range=${r}`;

  return (
    <main className="max-w-[840px] mx-auto p-6">
      <h1 className="text-[28px] font-extrabold mb-1">@{username}</h1>
      <p className="text-[14px] text-[var(--text-muted)] mb-4">Range: {r}</p>
      <div className="border-2 border-[var(--border-hard)]" style={{ boxShadow: "var(--shadow-brutal)" }}>
        <Image src={ogImage} alt="receipt" width={1200} height={630} className="w-full h-auto" />
      </div>
      <div className="mt-6"><ShareButton url={shareUrl} text={shareText} /></div>
    </main>
  );
}
```

Update Task 16's `headerSubFor` and `buildLines` if you want different copy per type — current implementation falls back gracefully.

- [ ] **Step 18.4: Commit**

```bash
git add src/app/share src/components/share
git commit -m "feat(receipt): share landing pages + ShareButton"
```

---

## Task 19: Modify POST /api/projects/verify response

**Files:**
- Modify: `src/app/api/projects/verify/route.ts`

- [ ] **Step 19.1: Inspect existing response**

```bash
cat src/app/api/projects/verify/route.ts | head -80
```

- [ ] **Step 19.2: Augment response when verification succeeds**

After the existing success path, before `NextResponse.json`:

```typescript
// project is the just-verified project; user is the owner
const shipped_receipt_url = `/share/${user.username}/shipped/${project.slug ?? project.id}`;
return NextResponse.json({ ok: true, project, shipped_receipt_url });
```

Front-end success-toast wiring lives in the existing client component — when it sees `shipped_receipt_url` in the response, render "🎉 shipped! share your receipt →".

- [ ] **Step 19.3: Commit**

```bash
git add src/app/api/projects/verify/route.ts
git commit -m "feat(receipt): return shipped_receipt_url from /api/projects/verify"
```

---

## Task 20: Add "Share my receipt" button to profile page

**Files:**
- Modify: `src/app/profile/[username]/page.tsx` (or the client component it renders)

- [ ] **Step 20.1: Add the button**

Locate the profile header area. Inject:

```tsx
import { ShareButton } from "@/components/share/share-button";

// In the profile header JSX:
<ShareButton url={`/share/${user.username}/custom?range=30d`} text={`Check out @${user.username} on VibeTalent`} />
```

For v1 we don't need the modal — direct to 30d. Modal can land post-hackathon.

- [ ] **Step 20.2: Commit**

```bash
git add src/app/profile/\[username\]/page.tsx
git commit -m "feat(receipt): Share my receipt button on profile"
```

---

## Task 21: Modify weekly-digest cron to embed receipt

**Files:**
- Modify: `src/lib/cron-jobs/weekly-digest.ts`

- [ ] **Step 21.1: Inspect email template**

```bash
grep -n "html\|template\|body" src/lib/cron-jobs/weekly-digest.ts | head -20
```

- [ ] **Step 21.2: Add receipt embed**

For each user the digest sends to, append a section to the HTML body:

```typescript
import { mondayOf } from "@/lib/cron-jobs/weekly-snapshot";

// Inside the loop where each user's email body is built:
const monday = mondayOf(new Date()).toISOString().slice(0, 10);
const receiptOg = `${process.env.NEXT_PUBLIC_SITE_URL}/api/og/receipt/weekly/${user.username}?w=${monday}`;
const receiptLink = `${process.env.NEXT_PUBLIC_SITE_URL}/share/${user.username}/weekly/${monday}`;

const receiptSection = `
  <div style="margin-top:32px;border-top:2px solid #EAEBEA;padding-top:24px">
    <p style="font-size:14px;color:#52525B;margin:0 0 12px">Your weekly receipt:</p>
    <a href="${receiptLink}"><img src="${receiptOg}" alt="weekly receipt" width="600" style="display:block;border:2px solid #0F0F0F"/></a>
    <a href="${receiptLink}" style="display:inline-block;margin-top:12px;background:#FF3A00;color:#fff;padding:10px 16px;font-weight:800;text-decoration:none;font-size:13px;">Share on X →</a>
  </div>`;

// Append to existing body before sending.
```

- [ ] **Step 21.3: Commit**

```bash
git add src/lib/cron-jobs/weekly-digest.ts
git commit -m "feat(receipt): embed weekly receipt in digest email"
```

---

## Task 22: GithubSparkline component

**Files:**
- Create: `src/components/projects/github-sparkline.tsx`

- [ ] **Step 22.1: Implement**

```tsx
// src/components/projects/github-sparkline.tsx
export function GithubSparkline({ values }: { values: number[] }) {
  // Always render 7 bars. Missing days padded with 0.
  const data = values.length === 7 ? values : [...values, ...Array(7 - values.length).fill(0)];
  const max = Math.max(...data, 1);
  const barWidth = 5;
  const gap = 2;
  const height = 24;
  return (
    <svg width={7 * barWidth + 6 * gap} height={height} aria-label={`commits last 7 days: ${data.join(", ")}`} role="img">
      {data.map((v, i) => {
        const h = Math.max(2, (v / max) * height);
        return (
          <rect
            key={i}
            x={i * (barWidth + gap)}
            y={height - h}
            width={barWidth}
            height={h}
            fill="#FF3A00"
            rx={1}
          />
        );
      })}
    </svg>
  );
}
```

- [ ] **Step 22.2: Commit**

```bash
git add src/components/projects/github-sparkline.tsx
git commit -m "feat(github-signal): inline SVG sparkline"
```

---

## Task 23: GithubSignal (compact) + GithubSignalExpanded

**Files:**
- Create: `src/components/projects/github-signal.tsx`
- Create: `src/components/projects/github-signal-expanded.tsx`

- [ ] **Step 23.1: GithubSignal**

```tsx
// src/components/projects/github-signal.tsx
import { GithubSparkline } from "./github-sparkline";

interface Props {
  commits7d: number | null;
  values7d: number[] | null;
  lastCommitAgo: string | null;
  githubUrl: string | null;
}

export function GithubSignal({ commits7d, values7d, lastCommitAgo, githubUrl }: Props) {
  if (!githubUrl) {
    return (
      <div className="text-[11px] font-extrabold tracking-wider text-[var(--text-muted)] uppercase mt-2 px-3 py-2 bg-[var(--bg-surface-light)] rounded">
        no github linked
      </div>
    );
  }
  return (
    <div className="mt-3 px-3 py-2.5 bg-[var(--bg-inverted)] text-[var(--text-on-inverted)] rounded grid items-center gap-3 font-mono" style={{ gridTemplateColumns: "1fr auto auto" }}>
      <div>
        <div className="text-[11px] text-[var(--text-muted)] tracking-wider font-extrabold">COMMITS / 7d</div>
        <div className="text-[16px] font-extrabold text-[var(--accent)] leading-none mt-1">{commits7d ?? 0}</div>
      </div>
      <GithubSparkline values={values7d ?? []} />
      <div className="text-right text-[12px]">
        {lastCommitAgo ?? "—"}
        <div className="text-[10px] text-[var(--text-muted)]">last commit</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 23.2: GithubSignalExpanded**

```tsx
// src/components/projects/github-signal-expanded.tsx
import { GithubSparkline } from "./github-sparkline";

interface Props {
  commits7d: number | null;
  values7d: number[] | null;
  lastCommitHash: string | null;
  lastCommitMessage: string | null;
  lastCommitAgo: string | null;
  githubUrl: string | null;
}

export function GithubSignalExpanded({ commits7d, values7d, lastCommitHash, lastCommitMessage, lastCommitAgo, githubUrl }: Props) {
  if (!githubUrl) return null;
  const showMessage = lastCommitMessage && lastCommitMessage.trim().length >= 5;

  return (
    <div className="mt-3 bg-[var(--bg-inverted)] text-[var(--text-on-inverted)] rounded font-mono overflow-hidden">
      <div className="grid items-center gap-3 px-3 py-2.5 border-b border-[#2a2a2a]" style={{ gridTemplateColumns: "1fr auto" }}>
        <div>
          <div className="text-[11px] text-[var(--text-muted)] tracking-wider font-extrabold">COMMITS / 7d</div>
          <div className="text-[16px] font-extrabold text-[var(--accent)] leading-none mt-1">{commits7d ?? 0}</div>
        </div>
        <GithubSparkline values={values7d ?? []} />
      </div>
      {showMessage && lastCommitHash && (
        <div className="px-3 py-2 flex gap-2 items-center text-[12px]">
          <span className="bg-[var(--accent)] text-[var(--bg-inverted)] px-1.5 font-extrabold rounded-sm">{lastCommitHash.slice(0, 6)}</span>
          <span className="flex-1 truncate">{lastCommitMessage}</span>
          {lastCommitAgo && <span className="text-[10px] text-[var(--text-muted)]">{lastCommitAgo}</span>}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 23.3: Commit**

```bash
git add src/components/projects/github-signal.tsx src/components/projects/github-signal-expanded.tsx
git commit -m "feat(github-signal): compact + expanded variants"
```

---

## Task 24: Wire GitHub signal into project cards

**Files:**
- Modify wherever project cards are rendered: search for the `ProjectCard` (or equivalent) component(s) under `src/components/projects/`.

- [ ] **Step 24.1: Locate the card**

```bash
grep -rn "ProjectCard\|project_card\|<.*Card.*project" src/components/projects/ src/components/explore/ src/components/homepage/ | head
```

- [ ] **Step 24.2: Inject `<GithubSignal />`**

In each card render, after the existing pills/score row:

```tsx
import { GithubSignal } from "@/components/projects/github-signal";

// Inside the card:
<GithubSignal
  commits7d={project.github_commits_last_7d ?? null}
  values7d={project.github_commits_daily_7d ?? null}
  lastCommitAgo={project.github_last_commit_relative ?? null}
  githubUrl={project.github_url ?? null}
/>
```

If `github_commits_last_7d` etc. aren't on the existing select, expand the query (don't fetch lazily — these come from the same `projects` row).

- [ ] **Step 24.3: Detail page uses Expanded**

In `src/app/projects/[id]/page.tsx` (or wherever single-project detail lives), use `<GithubSignalExpanded />` with last commit message + hash.

- [ ] **Step 24.4: Visual smoke test**

```bash
npm run dev
# Visit /explore and /projects — confirm sparklines render on cards, no layout shift.
# Visit a project detail page — confirm expanded version shows.
```

- [ ] **Step 24.5: Commit**

```bash
git add src/components/projects/ src/components/explore/ src/components/homepage/ src/app/projects
git commit -m "feat(github-signal): wire sparklines into cards + detail"
```

---

## Task 25: Wire reviewer stats into profile + byline into reviews

**Files:**
- Modify: profile page render + reviews list render

- [ ] **Step 25.1: Profile — add ReviewerStats**

```bash
grep -rn "profile.*reviews\|reviews.*profile" src/app/profile src/components/profile | head
```

In the profile component, fetch counts:
- `reviews_given_count = SELECT count(*) FROM reviews WHERE reviewer_user_id = user.id`
- `reviews_given_30d = same with created_at > now() - interval '30 days'`

Add to the SSR data shape, render `<ReviewerStats ...>`.

- [ ] **Step 25.2: Reviews list — replace plain "by Name" with `<ReviewerByline />`**

```bash
grep -rn "reviewer_name" src/components | head
```

In the reviews list component, hydrate reviewer profile info when `reviewer_user_id` is set:

```tsx
<ReviewerByline
  reviewerName={review.reviewer_name}
  reviewerUsername={review.reviewer?.username ?? null}
  reviewsGiven={review.reviewer?.reviews_given_count ?? null}
  calibration={review.reviewer?.reviewer_calibration ?? null}
  tier={review.reviewer?.reviewer_tier ?? null}
/>
```

This requires the reviews fetch (in `/api/reviews` GET) to also join `users` on `reviewer_user_id`. Update the SELECT.

- [ ] **Step 25.3: Commit**

```bash
git add src/app/profile src/components/profile src/components/reviews src/app/api/reviews
git commit -m "feat(reviewer): wire ReviewerStats + ReviewerByline into profile + reviews"
```

---

## Task 26: Seed data for demo

**Files:**
- Create: `scripts/seed-social-visibility.ts`

- [ ] **Step 26.1: Implement seed script**

```typescript
// scripts/seed-social-visibility.ts
// Usage: npx tsx scripts/seed-social-visibility.ts
// Inserts: 4 weekly snapshot rows (last Monday) + mock review activity for 1 user.
import { createAdminClient } from "../src/lib/supabase/admin";
import { mondayOf } from "../src/lib/cron-jobs/weekly-snapshot";

async function main() {
  const sb = createAdminClient();
  const today = new Date();
  const thisMonday = mondayOf(today).toISOString().slice(0, 10);
  const lastMonday = (() => { const d = mondayOf(today); d.setUTCDate(d.getUTCDate() - 7); return d.toISOString().slice(0, 10); })();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: users } = await (sb as any).from("users").select("id, username, vibe_score").gt("vibe_score", 50).order("vibe_score", { ascending: false }).limit(8);
  if (!users || users.length < 2) {
    console.error("Need at least 2 users in DB to seed climber data.");
    process.exit(1);
  }

  const rows = (users as Array<{ id: string; vibe_score: number }>).map((u, i) => ({
    user_id: u.id, week_start: lastMonday, vibe_score: Math.max(100, u.vibe_score - 50 - i * 10), rank: users.length - i, commits_7d: 0,
  }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (sb as any).from("vibe_score_weekly_snapshots").upsert(rows, { onConflict: "user_id,week_start" });

  console.log(`Seeded ${rows.length} snapshot rows for week_start=${lastMonday}.`);
  console.log(`Now visit /leaderboard — weekly tab should show climbers.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 26.2: Run + verify**

```bash
npx tsx scripts/seed-social-visibility.ts
# Expected: "Seeded N snapshot rows..."
# Visit http://localhost:3000/leaderboard → weekly tab populated.
```

- [ ] **Step 26.3: Commit**

```bash
git add scripts/seed-social-visibility.ts
git commit -m "chore(seed): demo data for weekly leaderboard"
```

---

## Task 27: Pre-push verification gate (systematic-debugging)

**Files:**
- None. This is a runtime/visual checklist.

- [ ] **Step 27.1: Build**

```bash
npm run build
# Expected: exits 0, no TypeScript errors, no unused-import warnings on new files
```

- [ ] **Step 27.2: Lint**

```bash
npm run lint
# Expected: exits 0
```

- [ ] **Step 27.3: Tests**

```bash
npm run test
# Expected: all passing including new files in src/lib/reviewer/__tests__, src/lib/cron-jobs/__tests__, src/lib/leaderboard/__tests__
```

- [ ] **Step 27.4: Migration cleanliness**

```bash
supabase db reset    # clean apply from scratch
# Expected: migration 20260512 applies without errors
```

- [ ] **Step 27.5: OG images render — light + dark**

```bash
npm run dev
# Open each in browser, take a screenshot, eyeball at 100% zoom:
open "http://localhost:3000/profile/<u>/opengraph-image"
open "http://localhost:3000/api/og/receipt/weekly/<u>"
open "http://localhost:3000/api/og/receipt/shipped/<u>"
open "http://localhost:3000/api/og/receipt/custom/<u>"
# Confirm: text renders (no boxes), brand colors correct, no clipping
```

- [ ] **Step 27.6: Mobile readability**

In Chrome DevTools device toolbar, set iPhone SE (375px), visit:
- `/leaderboard` — confirm hero numbers stay ≥22px, no horizontal overflow
- a profile page — confirm ReviewerStats two-column grid, no clipping
- `/explore` — sparklines fit cards

- [ ] **Step 27.7: Empty/null-state spot checks**

- A new user (no snapshot) — does weekly tab still render them, or filter? (Should filter — they're below floor or no snapshot.)
- A project with no `github_url` — confirm "no github linked" pill, no broken sparkline.
- A logged-out reviewer's review — confirm ReviewerByline falls back to `reviewer_name` only.

- [ ] **Step 27.8: Manual calibration sanity check**

Pick a user with seeded reviews. Hand-compute their expected calibration. Run the daily cron, query `users.reviewer_calibration` for that user, confirm match within ±0.5.

- [ ] **Step 27.9: Cron config unchanged**

```bash
git diff main -- vercel.json
# Expected: no change to crons array (we extended existing handlers, didn't add new slots)
```

- [ ] **Step 27.10: Final commit + push**

If everything above passes:

```bash
git push -u origin feat/social-visibility-pack
```

Then open the PR via `gh pr create` (or web UI). PR body should include: feature summary, screenshots of each surface, the verification checklist above with all boxes ticked.

---

## Notes for the implementing agent

- **Don't free-hand sql** — let supabase CLI handle migrations consistently across local + prod.
- **Don't add a new Vercel cron** — we're at the 5-cron Hobby limit per memory. Extend existing handlers instead.
- **Don't invent auth patterns** — for the reviewer_user_id wiring in Task 8, match whatever auth detection `/api/projects/verify` or similar already uses.
- **Don't strip the existing `LeaderboardContent`** — Task 14 layers tabs on top so the existing all-time view stays untouched.
- **If you hit a Tailwind v4 quirk** — recall: no `tailwind.config.*` in this repo; use CSS variables from `globals.css` (e.g. `var(--accent)`, `var(--border-hard)`).
- **OG images use `next/og`'s `ImageResponse`**, NOT `@vercel/og` directly — Next 16 bundles it.
- **Per memory**: dark mode uses warm-grey palette (hue 14°), white only for primary elements. Test every new surface in dark mode before push.
