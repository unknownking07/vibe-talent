# CLAUDE.md

Guidance for Claude Code working in this repo. Keep it current; prefer fixing this file over re-explaining things each session.

## What this is

VibeTalent — a reputation + hiring marketplace for "vibe coders" (AI-assisted developers). Builders have public profiles with a **vibe_score** (reputation), GitHub-verified **projects** with automated quality scoring, **endorsements**, **reviews**, daily **streaks** ("vibed"), a **leaderboard**, a **hire** flow, and paid **featured promotions** (USDC). Heavy SEO/AEO surface (sitemap, `llms.txt`, JSON-LD, glossary, `vs/` comparison pages). Live at vibetalent.work.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Supabase (Postgres + Auth + RLS) · Privy (wallet/social auth) · Solana (`@solana/kit`, web3.js) + Base/EVM (`viem`) for USDC · Upstash Redis (rate limit) · Resend (email) · Vitest. Hosted on **Cloudflare Workers** (OpenNext adapter); push-to-deploy via GitHub Actions.

## Commands

```bash
npm run dev          # next dev
npm run build        # next build
npm run lint         # eslint (see gotcha: scope to src/ for clean signal)
npm run test         # vitest run
npx tsc --noEmit     # type-check
./node_modules/.bin/eslint src   # CI-faithful lint — src/ only, skips the vibecoders/ noise
```

## Where things live

- `src/app/` — routes (App Router): `dashboard`, `explore`, `profile`, `projects`, `hire`, `leaderboard`, `pricing`, `roadmap`, `admin`, `feed`, `vs`, SEO files (`sitemap.ts`, `robots.ts`, `llms.txt`).
- `src/app/api/` — route handlers: `projects`, `endorsements`, `reviews`, `streak`, `hire`, `promotions`, `github`, `notifications`, `leaderboard`, `og`, `v1/` (public API), `cron/` (scheduled jobs).
- `src/lib/` — domain logic: scoring (`agent-scoring.ts`, `github-quality.ts`, `scoring-config.ts`), payments (`solana-payment.ts`, `chains-config.ts`, `featured-promotions.ts`, `pricing.ts`), `streak.ts`, `notifications.ts`, `email.ts`, `supabase/`, `rate-limit.ts`, `validation.ts`, `json-ld.ts`, `seo.ts`.
- `src/components/` — by domain (`profile`, `projects`, `reviews`, `dashboard`, `homepage`, `ui`, …).
- `supabase/` — `schema.sql` + `migrations/` (31). **`schema.sql` is not the live schema** — it declares 10 tables; prod has 19. Migrations are the source of truth; check the DB before assuming a table/column doesn't exist.
- **Supabase Storage** — two public buckets, `avatars` and `project-images` (uploaded from `dashboard/page.tsx`). Files live in object storage; the DB stores only URL `TEXT` columns (`avatar_url`, `image_url`). No `bytea`/blob columns anywhere — keep it that way.
- `src/middleware.ts` — auth/routing middleware.

## Critical conventions & gotchas

- **`vibecoders/` is a gitignored duplicate folder.** It pollutes full-repo eslint with ~10k noise errors. Lint/build/grep against root `src/` only.
- **Two project-create paths exist.** Only `POST /api/projects` runs the GitHub auto-verify + quality-scoring pipeline. **Never insert a project directly** (DB or the other path) — it'll skip verification.
- **Supabase empties `search_path` for functions.** Unqualified table refs in triggers/SECURITY DEFINER functions fail with "relation does not exist." Schema-qualify (e.g. `public.users`) inside DB functions.
- **Security model: RLS is the only gate.** Don't rely on app-layer checks alone. Reputation columns (`vibe_score`, streaks) are locked — written only via SECURITY DEFINER functions (e.g. `update_user_streak`). `reviewer_email` is never exposed to clients; review deletion is session-only (IDOR-guarded). Render JSON-LD via the `jsonLdHtml` helper, never raw interpolation (stored-XSS).
- **Never run `supabase db push`.** The local migration history is out of sync with the remote one: 33 files in `supabase/migrations/`, 5 rows in the remote migration table, and the filename versions (`20260714_...`) don't match the recorded ones (`20260713195405`). `db push` would treat ~28 migrations as pending and replay them — including `recalculate_vibe_scores.sql`, which rewrites every user's score. Apply migrations **one at a time** via the Supabase SQL editor, and still commit the `.sql` file so the intent is reviewable. Migrations don't take effect until applied — review carefully; this is a small pre-revenue team (see infra notes).
- **GitHub OAuth is public-only** (no `repo` scope — it's read+write+admin and triggers a scary consent). `provider_token` is not available server-side; private-repo support is deferred to a read-only GitHub App.
- **OG/social previews cache by page URL** on Discord/Twitter. Renaming an image does **not** bust the cache — append `?v=N` to the URL.
- **Dark mode uses warm greys** (hue ~14°), not neutral greys. Reserve pure white for primary elements only.
- **Payments:** USDC, Base today; multichain (ETH/Solana) on the roadmap. `featured_promotions` is the on-chain-promotion registry (verify ownership before honoring). $VIBE token price comes from GeckoTerminal (not on Jupiter). Treat on-chain/payment changes as high-risk — confirm before touching.

## Infra / deploy

- **Cloudflare Workers** (OpenNext adapter, `@opennextjs/cloudflare`), $0 on Workers Paid (startup credits). www + apex serve from the `vibetalent` Worker via Workers Routes; apex→www 301 lives in `worker.ts`.
- **Deploy = push to `main`** → GitHub Actions (`.github/workflows/deploy-cloudflare.yml`) runs `opennextjs-cloudflare build` + `wrangler deploy`. Needs the `CLOUDFLARE_API_TOKEN` repo secret + the public `NEXT_PUBLIC_*` values as repo Actions **variables** (inlined at build). The deploy step temporarily hides `open-next.config.ts` to bypass OpenNext's flaky KV/D1 cache-populate (`10021`/`10000`); the cache warms lazily at runtime. Runtime secrets live on the Worker and persist across deploys.
- **5 crons run on GitHub Actions** (`.github/workflows/cron.yml`), **NOT** Cloudflare Worker triggers — CF's `scheduled()` handler fires but its in-process fetch to `/api/cron/*` never runs the OpenNext route (jobs silently no-op), so `wrangler.jsonc` `triggers.crons` stay disabled. GH Actions `curl`s each route over real external HTTPS with the `CRON_SECRET` bearer token (repo secret); `workflow_dispatch` input `route=<name>` runs one manually. Schedules mirror the old `vercel.json` (daily `0 6 * * *` = 11:30 AM IST, etc.); GH Actions cron is UTC + best-effort (may fire a few min late).
- **The `daily` orchestrator fans out to its 8 children via the `WORKER_SELF_REFERENCE` service binding, not a self-`fetch()`.** On Cloudflare a Worker→own-hostname call is an edge loopback that **strips the `Authorization` header**, so every child 401s (feed/streaks/lifecycle-emails silently die) while `daily` itself returns 200. Use the binding (`getCloudflareContext().env`) for any Worker-to-self cron fan-out; fall back to `fetch()` off Cloudflare. Directly-scheduled crons (quality-rescore, verify-backfill) are unaffected — they're called externally, not through the loopback.
- **`NEXT_PUBLIC_SITE_URL`** is inlined at build (drives emails/API/manifests via `getSiteUrl()` in `seo.ts`; canonical/OG use a separate hardcoded const). Must be `https://www.vibetalent.work` at build — `.env.local` holds the localhost dev value, `.env.production.local` (gitignored) overrides local prod builds, a GH Actions var overrides in CI. A wrong value leaks `localhost` into emails + `/api/v1/builders`.
- **Cloudflare Bot Fight Mode is OFF** for this site — it was 403-ing server-to-server cron fanouts.
- **Vercel** is a dormant standby: git auto-deploy off (`vercel.json`), and its runtime Supabase is dead (legacy keys disabled). Safe to delete once CF is proven stable.
- **Pre-revenue, hackathon runway:** minimize infra cost; avoid risky migrations/large refactors close to demo day.

## Working style

- Find the **root cause** before fixing UI/behavior bugs; don't patch symptoms.
- **Clarify short/ambiguous reports** before diagnosing — don't guess what a pronoun or "it" refers to.
- Ship **clean, production-quality code on the first pass** — no placeholder logic or leftover TODOs. Self-review as if it had to pass code review; run `/simplify` after significant code.
- **Verify before claiming done** (run the build/tests/app); evidence before assertions.
- **Check a PR is still open before pushing** to it — if merged, branch off and open a new PR.
