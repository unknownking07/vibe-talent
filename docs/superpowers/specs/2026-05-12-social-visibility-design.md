# Social Visibility Pack — Design Spec

| | |
|---|---|
| **Date** | 2026-05-12 |
| **Status** | Approved — ready for implementation plan |
| **PR strategy** | Single PR on branch `feat/social-visibility-pack`, per-feature commits |
| **Demo target** | Bags app hackathon (no risky migrations, additive-only schema) |

---

## 1. Overview

Ship five tightly-related features that together turn VibeTalent into a *socially visible* platform — public ranking momentum, share-anywhere assets, and trust signals on every reviewer.

The features are independent enough to revert per-commit but cohesive enough to ship as one PR (per product decision).

## 2. Goals

- Make the platform's activity *visible* from outside without a login
- Give every active user something to post on X / Farcaster / LinkedIn weekly
- Surface GitHub momentum on every project card so claims become evidence
- Make reviews trustworthy by attaching a public, computed reputation to each reviewer

## 3. Non-goals (v1)

- **Milestone receipts** (rank threshold detection + share) — milestone cron exists, but UI/share path is deferred
- **Helpful-vote on reviews** — requires new schema + voting UI, deferred
- **Real-time activity** — leaderboard refreshes via existing ISR (60s), not push
- Any database backfill that touches more than one column at insert time
- Any feature requiring a new Vercel cron slot (we're at the Hobby 5-cron limit)

## 4. Locked decisions (from brainstorming)

| # | Decision | Choice |
|---|---|---|
| 1 | Leaderboard structure | One page `/leaderboard`, default tab "This week ▲", secondary tab "All-time" |
| 2 | Ranking algorithm | Sort by rank-position climb; display absolute `vibe_score` delta on row; floor `vibe_score ≥ 100` to qualify |
| 3 | Row layout | "B-refined" — stacked rows, 22px hero numbers, 13px meta, uppercase labels, crown-row tint on #1 |
| 4 | Profile share card | Style A "Brutalist Poster" — giant orange vibe_score on dot-grid background, 1200×630 OG |
| 5 | Receipt visual | Style B "Receipt Stub" — perforated edges, barcode, monospace, reused across all triggers |
| 6 | Receipt triggers (v1) | Weekly (auto), Project Shipped (auto), Manual share (user). Skip Milestone. |
| 7 | GitHub signal density | "B" compact + sparkline on cards; "C" expanded with last commit on detail page; filter sub-5-char messages |
| 8 | Reviewer reputation | Volume + calibration score + Bronze/Silver/Gold tier; calibration via nightly cron; skip helpful-votes |

## 5. Readability baseline (hard constraint on every surface)

- **Body text**: ≥ 13px
- **Hero numbers**: ≥ 22px
- **Contrast**: WCAG-AA minimum (no muted text < `#52525B` on white)
- **Labels under big numbers**: never let a number stand alone without a unit/label
- **Touch targets**: ≥ 44×44px
- **Dark mode**: warm grey palette (hue 14°), white only for primary elements (per existing memory)

This baseline applies to leaderboard rows, share cards, receipts, project cards, and the reviewer profile block — anything new in this PR.

## 6. Architecture

### 6.1 Schema (single migration: `supabase/migrations/20260512_social_visibility_pack.sql`)

```sql
-- Weekly snapshots — enables "climbed +12 spots since last week" math.
-- Only Monday rows. Per-user, append-only.
create table public.vibe_score_weekly_snapshots (
  user_id uuid not null references public.users(id) on delete cascade,
  week_start date not null,                              -- Monday of the week
  vibe_score integer not null,
  rank integer not null,
  commits_7d integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, week_start)
);

create index vibe_score_weekly_snapshots_week_rank_idx
  on public.vibe_score_weekly_snapshots (week_start, rank);

-- RLS: public read, no writes from clients (cron-only writes via service role)
alter table public.vibe_score_weekly_snapshots enable row level security;
create policy "weekly_snapshots_public_read"
  on public.vibe_score_weekly_snapshots for select using (true);

-- Reviewer reputation. Distinct from existing users.badge_level.
alter table public.users
  add column reviewer_calibration numeric(5,2),   -- 0.00–100.00; null = not enough data
  add column reviewer_tier text                   -- 'bronze' | 'silver' | 'gold' | null
    check (reviewer_tier is null or reviewer_tier in ('bronze','silver','gold'));

-- Link reviews to logged-in reviewers when the submitter is a platform user.
-- Anonymous reviews (from hire-request external reviewers) keep null here.
alter table public.reviews
  add column reviewer_user_id uuid references public.users(id) on delete set null;

create index reviews_reviewer_user_id_idx
  on public.reviews (reviewer_user_id) where reviewer_user_id is not null;
```

**Tier thresholds** (tunable constants in `src/lib/reviewer/tier.ts`):
| Tier | Min reviews | Min calibration |
|---|---|---|
| Bronze | 10 | 70% |
| Silver | 30 | 80% |
| Gold | 75 | 85% |

Calibration < min review threshold OR < tier-min → `reviewer_tier = null` (no badge shown).

### 6.2 Cron jobs — extend existing only, no new slots

| Cron | Existing role | New responsibility |
|---|---|---|
| `quality-rescore` (daily 04:00 UTC) | Recompute vibe scores | If today is Monday, also write all users' snapshot row to `vibe_score_weekly_snapshots` |
| `daily` (06:00 UTC) | Daily tasks | Add calibration job — recompute `reviewer_calibration` + `reviewer_tier` for reviewers with ≥ 5 reviews |
| `weekly-digest` (Mon+Tue 15:00 UTC) | Weekly email | Embed receipt OG image and link to `/share/[username]/weekly/[week]` |

### 6.3 API surface

**New endpoints**
- `GET /api/leaderboard?range=week&limit=N` — extends existing `/api/leaderboard` route with a `range` query param. `range=week` returns weekly climbers; default `range=all` preserves current behavior.
- `GET /api/receipt/[username]/weekly?week=YYYY-MM-DD` — returns JSON for a weekly receipt
- `GET /api/og/profile/[username]` — Brutalist Poster (replaces existing `app/profile/[username]/opengraph-image.tsx`)
- `GET /api/og/receipt/[type]/[username]` — Receipt Stub (type: `weekly` | `shipped` | `custom`)

**Modified endpoints**
- `POST /api/projects/verify` — response shape adds `{ shipped_receipt_url: string }` so the success toast can link directly
- `POST /api/reviews` — when the submitter is authenticated, set `reviewer_user_id = current_user.id`; leave null for anonymous external reviewers (existing flow unchanged otherwise)

### 6.4 File map

```
supabase/migrations/
  20260512_social_visibility_pack.sql                  NEW

src/lib/
  cron-jobs/
    weekly-snapshot.ts                                 NEW
    reviewer-calibration.ts                            NEW
    weekly-digest.ts                                   MODIFY (embed receipt)
  reviewer/
    tier.ts                                            NEW (thresholds + classifier)
    calibration.ts                                     NEW (math)
  leaderboard/
    weekly.ts                                          NEW (query + delta computation)

src/app/api/
  leaderboard/route.ts                                 MODIFY (?range=week)
  receipt/[username]/weekly/route.ts                   NEW
  og/profile/[username]/route.tsx                      NEW (replaces opengraph-image.tsx)
  og/receipt/[type]/[username]/route.tsx               NEW
  projects/verify/route.ts                             MODIFY (return shipped_receipt_url)

src/app/
  leaderboard/page.tsx                                 MODIFY (tab wrapper)
  share/[username]/weekly/[week]/page.tsx              NEW (receipt landing page)
  share/[username]/shipped/[slug]/page.tsx             NEW
  share/[username]/custom/page.tsx                     NEW

src/components/
  leaderboard/
    weekly-tab.tsx                                     NEW
    all-time-tab.tsx                                   NEW (refactor from existing content)
    row.tsx                                            NEW (B-refined)
    row-meta.tsx                                       NEW (rank-was, climb spots)
  projects/
    github-signal.tsx                                  NEW (compact + sparkline)
    github-sparkline.tsx                               NEW (inline SVG)
    github-signal-expanded.tsx                         NEW (with last commit, detail page)
  profile/
    reviewer-stats.tsx                                 NEW
  reviews/
    reviewer-byline.tsx                                NEW
  share/
    share-button.tsx                                   NEW (copy + native share intents)
    receipt-preview.tsx                                NEW
    receipt-stub.tsx                                   NEW (the SVG/JSX for OG render)
```

## 7. Data flow (per feature)

### 7.1 Leaderboard "This week" view
1. User hits `/leaderboard` → server-side fetch via `fetchWeeklyClimbers()`
2. Reads `vibe_score_weekly_snapshots WHERE week_start = last_monday`, joined with current `users`
3. Computes `rank_delta = snapshot.rank - current_rank_position` per user
4. Filters out users where `users.vibe_score < 100`
5. Sorts by `rank_delta DESC`, secondary `vibe_score DESC`
6. Renders the B-refined row component with: rank, avatar, handle, `was #X`, `▲N spots`, current score, `+Δ` delta
7. Cache: `revalidate = 60` (matches existing leaderboard page)

### 7.2 Profile share card (OG image)
1. Anyone shares `vibetalent.work/profile/abhi` → X/Farcaster scrapes meta tags
2. `og:image` meta points to `/api/og/profile/abhi`
3. `@vercel/og` renders the Brutalist Poster JSX server-side at 1200×630
4. Output PNG is CDN-cached at the edge. Cache key includes `(username, vibe_score, updated_at)` — a vibe_score change naturally invalidates the cached image, so no manual `?v=X` (per `feedback_og_cache_platforms.md`). Note: third-party scrapers (X, Discord) still cache by *URL*, not response — for those, week-stamped URLs (`?w=2026-W19`) serve the role of cache-busting on the public side.

### 7.3 Weekly receipt
1. Mon 15:00 UTC: `weekly-digest` cron fires
2. For each active user with a snapshot this week: build receipt JSON (commits, projects, rank delta, vibe score)
3. Email body embeds `<img src="/api/og/receipt/weekly/abhi?w=2026-W19" />` and a CTA link to `/share/abhi/weekly/2026-W19`
4. The receipt landing page renders the same OG image preview plus native share buttons (copy / X intent / Farcaster intent)

### 7.4 Project shipped receipt
1. User marks project verified → `POST /api/projects/verify` (existing flow)
2. Response now includes `shipped_receipt_url: "/share/abhi/shipped/my-project"`
3. Frontend success toast becomes "🎉 shipped! → share your receipt" with the URL pre-populated
4. Receipt URL resolves to a landing page with the receipt OG image + share buttons

### 7.5 Manual share
1. Profile page has a "Share my receipt" button
2. Click opens a modal: 7d / 30d / all-time selector
3. Selection resolves to `/share/abhi/custom?range=30d`
4. Page renders with corresponding OG image and share buttons

### 7.6 GitHub signal on project cards
1. Card mounts — `<GithubSignal project={project} />`
2. Reads `project.github_commits_last_7d` (populated by existing `github-sync` cron)
3. Renders sparkline (inline SVG, 7 bars, max height 24px) + "47 commits / 7d" + "2h ago"
4. Fallback: if `github_url` is null → render greyed "no GitHub linked" pill (no error state)
5. Detail page (`/projects/[id]`) uses `<GithubSignalExpanded />` which adds last commit hash + message (filter messages < 5 chars; fallback to project description)

### 7.7 Reviewer calibration
1. Nightly daily cron, ~03:00 UTC
2. **Scope:** only reviews where `reviewer_user_id IS NOT NULL` (logged-in users). Anonymous reviews never contribute to anyone's calibration.
3. For each `reviewer_user_id` with `count(*) >= 5` matching reviews:
   - For each of their reviews: `error_i = |stars_normalized - builder_percentile|` where `stars_normalized = rating / 5` and `builder_percentile = builder's vibe_score percentile across all users / 100`
   - `calibration = 100 - mean(error_i) * 100`
4. Classify tier per thresholds (Bronze ≥10 reviews + 70% / Silver ≥30 + 80% / Gold ≥75 + 85%)
5. Upsert `users.reviewer_calibration` + `users.reviewer_tier` in a single batch

**Review submit flow update (for §6.3 modified endpoints):**
- `POST /api/reviews` — when the submitter is authenticated (Privy session present), set `reviewer_user_id = current_user.id`. When anonymous, leave null. No other changes to existing trust_score logic.

## 8. Edge cases handled

| Case | Behavior |
|---|---|
| New user, no snapshot yet | Weekly tab includes them but `delta = —` cell, no climb pill |
| User joined this week | Not eligible for weekly tab (no prior snapshot to compare) |
| Reviewer with < 5 reviews (logged-in only) | `calibration = null`, `tier = null`, byline shows just count, no badge |
| Anonymous review (`reviewer_user_id IS NULL`) | Never counts toward anyone's calibration; review byline shows `reviewer_name` (existing behavior) |
| Project with no GitHub linked | Sparkline replaced with greyed "no GitHub linked" pill |
| Commit messages < 5 chars or matches `/^(wip|fix|asdf|test)$/i` | Filtered from detail page, falls back to project description |
| OG image render fails | Static fallback PNG at `/og-fallback-profile.png`, returned with 200 |
| Week boundary crossed during share | Receipt URL is a permalink — `/share/abhi/weekly/2026-W19` keeps resolving to W19 data forever |
| Score crosses 100 floor mid-week | User appears in weekly tab next snapshot, not retroactive |

## 9. Performance

- **Calibration cron**: O(reviews) per night, ~10ms per reviewer for math, batched upserts. Hundreds of reviewers → < 30s.
- **Weekly snapshot insert**: single bulk `INSERT … SELECT` from `users` for all users with score ≥ 1. < 5s.
- **OG render**: < 1s cold, < 50ms cached. CDN-cached 24h or until cache key changes.
- **Leaderboard weekly query**: indexed on `(week_start, rank)`. < 100ms for 100-row response.

## 10. Risk & rollback

| Risk | Mitigation |
|---|---|
| `@vercel/og` font loading box-renders | Pre-bundle Inter as base64, fallback chain to system fonts, visual test before push |
| Calibration math has a bug, tiers go wrong | Hand-validate against 3 sample users before deploy; tiers are nullable so worst case "no badge shown" |
| Migration partially applied | Each statement is independently safe; can be re-run; rollback is `DROP TABLE` + `DROP COLUMN` |
| Single PR breaks something | Per-feature commits enable `git revert <sha>` for the bad feature without unwinding the rest |
| CRON_SECRET drift on new cron logic | Reuse existing secret in modified crons — no new env var |

**Rollback migration** (kept in same file, commented):
```sql
-- ROLLBACK (commented; uncomment + run if needed)
-- drop table if exists public.vibe_score_weekly_snapshots;
-- alter table public.users
--   drop column if exists reviewer_calibration,
--   drop column if exists reviewer_tier;
```

## 11. PR plan

**Branch**: `feat/social-visibility-pack`

**Commit sequence** (each independently revertable, each passes `npm run build` + `npm run lint`):
```
feat(db): vibe_score_weekly_snapshots + reviewer columns
feat(reviewer-rep): calibration cron + tier badges + profile block
feat(leaderboard): weekly snapshot cron + B-refined row + tabs
feat(og): Brutalist Poster profile share card
feat(receipt): receipt stub OG + weekly/shipped/manual triggers + share landing pages
feat(github-signal): sparkline on cards + expanded on detail page
chore(seed): demo data for leaderboard + receipts
docs(pr): PR description with screenshots and brand baseline
```

## 12. Pre-push verification (systematic-debugging gate)

Hard gate before `git push`:

- [ ] `npm run build` exits 0
- [ ] `npm run lint` exits 0
- [ ] Local Supabase: migration applies cleanly; rollback applies cleanly
- [ ] OG images render at 1200×630 in light AND dark mode (warm-grey palette, white only for primary)
- [ ] Calibration math sanity-check: hand-compute for 3 sample reviewers, compare to cron output
- [ ] New-user empty states: empty leaderboard delta cell, empty reviewer block, "no GitHub linked" fallback
- [ ] Mobile readability: iPhone SE width, all hero numbers ≥ 22px, no horizontal overflow
- [ ] Receipt URL permalink survives week boundary (manually advance week_start, confirm old URL still resolves)
- [ ] `vercel.json` cron schedule unchanged (no new slot)
- [ ] No unqualified table refs in any new trigger function (per `project_supabase_search_path.md`)

## 13. Deferred (post-hackathon GitHub issues, filed after PR merges)

1. **Milestone receipts** — surface receipts on rank threshold crossings (top 100/50/10/1). `milestone-check` cron already exists.
2. **Helpful-vote on reviews** — adds the third reputation column ("C" reviewer rep). Needs new schema + voting UI.
3. **Daily snapshots** — currently we snapshot Mondays only. Daily would enable "climb today" views.
4. **Calibration tuning** — re-evaluate thresholds after first 4 weeks of data.

## 14. Open questions

None blocking. The following are conscious choices we'd revisit if data says otherwise:

- Tier thresholds (Bronze 70% / Silver 80% / Gold 85%) are guesses — tune after seeing real calibration distribution.
- Floor at `vibe_score ≥ 100` for weekly leaderboard is a guess — tune if it filters too aggressively at low user counts.
