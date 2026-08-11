# Promotions Blend — Implementation Plan (Plan 2 of 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement task-by-task. Steps use `- [ ]`. Work in an isolated worktree on `feat/promotions-blend` off `main`.

**Goal:** Move featured-promotion **display** to a `/projects` "✦ Featured" shelf, **soften** the global marquee, and **re-home the promote/buy flow** into discoverable entry points (dashboard "Feature this project" + post-publish prompt + a `/projects` nudge) that route through a single, rail-agnostic checkout — reusing the existing payment + ownership-gate code unchanged.

**Architecture:** This is **re-homing, not rewriting.** The buy flow (`FeatureYourProjectCard`) is already self-contained and grants promotions via server-verified endpoints (`/api/promotions` for Base, `/api/solana/verify` for Solana) with non-negotiable ownership checks. We do **NOT** touch payment execution, the `featured_promotions` registry, the RPC/contract calls, or the ownership gates. We only change **where the buy card is mounted** and **where featured projects display**. The checkout is kept rail-agnostic so a card (Dodo) handler drops in later (Plan = fast-follow).

**Tech Stack:** Next.js 16 App Router · React 19 · TS · Tailwind v4 · Supabase · Privy/viem/@solana. Verify: `tsc --noEmit`, `eslint <files>`, `npm run build`, visual on `/projects`, `/pricing`, `/dashboard`.

**🔒 HIGH-RISK / DO NOT TOUCH:** `src/app/api/promotions/route.ts`, `src/app/api/solana/verify/route.ts`, `src/app/api/solana/quote/route.ts`, `src/lib/promotion-pricing.ts`, `src/lib/solana-payment.ts`, `src/lib/chains-config.ts`, the `featured_promotions` table/RLS, and the `handlePromoteEVM/handlePromoteSolana` logic inside the buy card. Reuse them as-is.

---

## ⚠️ Sequencing vs PR #207

PR #207 (homepage refocus) **removed the homepage `<FeaturedCarousel/>`**, which orphaned the only buy entry (`FeatureYourProjectCard` lived inside it). **This plan re-homes that buy flow**, closing the gap. Therefore: **merge Plan 2 *before* or *together with* #207** — never merge #207 alone first, or promotions become un-buyable until Plan 2 ships. Branch `feat/promotions-blend` off `main`; its files don't overlap #207's, so both merge cleanly in either order *content-wise* — the constraint is purely the buy-flow gap.

## File structure

| File | Action | Responsibility |
|---|---|---|
| `src/components/ui/featured/featured-shelf.tsx` | Create | The `/projects` "✦ Featured" shelf (reuses `FeaturedProjectCard` + `fetchPromotions`/`enrichPromotions`) |
| `src/app/pricing/checkout-card.tsx` (or section in `pricing/page.tsx`) | Create/Modify | Mounts the existing `FeatureYourProjectCard` as the canonical checkout; accepts optional preselected `project_id` |
| `src/app/projects/page.tsx` | Modify | Server-fetch featured promos; render `<FeaturedShelf/>` above `<ProjectsContent/>` + the "Want yours featured?" nudge |
| `src/components/ui/project-card.tsx` | Modify | Add an optional "Feature this project" action (shown only on the owner's dashboard cards) |
| `src/app/dashboard/page.tsx` | Modify | Wire the project-card "Feature" action + the post-publish "🎉 feature it?" prompt into `handleAddProject` success |
| `src/components/ui/promo-billboard-client.tsx` | Modify | **Soften** the marquee (CSS/visual only) |
| `src/components/ui/featured/feature-your-project-card.tsx` | Modify (minimal) | Accept an optional `preselectedProjectId` prop so entries can deep-link a project; **no payment-logic change** |

Reused unchanged: `FeaturedProjectCard`, `EmptySlotCard`, `featured-promotions.ts`, all `/api/*` endpoints, pricing libs.

---

### Task 0: Branch (isolated worktree)
- [ ] `git worktree add .claude/worktrees/promotions-blend feat/promotions-blend` (branch off `main`), symlink `node_modules` + `.env.local`, confirm `git branch --show-current` == `feat/promotions-blend`. Work ONLY in this worktree (other sessions use the main checkout).

### Task 1: Re-home the buy flow → canonical `/pricing` checkout (closes the orphan gap)
**Files:** `src/app/pricing/page.tsx` (+ a `checkout-card.tsx`), minimal prop add to `feature-your-project-card.tsx`.
- [ ] Add an optional `preselectedProjectId?: string` prop to `FeatureYourProjectCard` → preselects that project in its dropdown (the dropdown already exists at lines ~671-688; just default its state from the prop). **Do not change any payment handler.**
- [ ] Mount `FeatureYourProjectCard` on `/pricing` (below the tiers) as the canonical buy location — reading `?project=<id>` from the URL to preselect. Keep its lazy `next/dynamic` wrapper (defers the Privy/wallet bundle).
- [ ] `/pricing` CTAs that previously pointed to `/#featured-projects` now scroll to / focus this checkout card.
- [ ] Verify: `tsc` + `eslint` clean; load `/pricing`, connect a wallet, confirm the buy card renders + a project can be preselected via `?project=<id>`. Commit.

### Task 2: `/projects` "✦ Featured" shelf (the new display home)
**Files:** Create `src/components/ui/featured/featured-shelf.tsx`; modify `src/app/projects/page.tsx`.
- [ ] Create `<FeaturedShelf promotions={...} />` — a compact top-of-page rail: a "✦ Featured" label + 1–3 `FeaturedProjectCard`s (reuse the component verbatim). NOT a carousel; static row, `grid sm:grid-cols-2 lg:grid-cols-3`. Renders nothing if zero active promos.
- [ ] In `src/app/projects/page.tsx` (server component): fetch + enrich promotions server-side (reuse `fetchPromotions`/`enrichPromotions`; mirror `promo-billboard.tsx`'s `unstable_cache` pattern), and render `<FeaturedShelf/>` **above** `<ProjectsContent/>`. The shelf is independent of the grid's search/sort/filter (never touched by them — per spec).
- [ ] Verify: `tsc` + `eslint` + visual on `/projects` (shelf appears above the grid with real promos; sort/filter on the grid don't disturb it). Commit.

### Task 3: Promote entry points
**Files:** `src/components/ui/project-card.tsx`, `src/app/dashboard/page.tsx`, `src/app/projects/page.tsx`.
- [ ] Add an optional `onFeature?: () => void` (or `showFeature?: boolean`) to `ProjectCard`; when set, render a subtle "✦ Feature" button. Only the **dashboard** owner-cards pass it (dashboard grid at page.tsx:1582-1603) — it links to `/pricing?project=<project.id>`.
- [ ] Add a "Want your build featured? →" nudge near the `/projects` shelf (in `featured-shelf.tsx` or projects page) → `/pricing`.
- [ ] Verify: `tsc` + `eslint` + visual (dashboard cards show "✦ Feature" → /pricing with the project preselected; /projects nudge works). Commit.

### Task 4: Post-publish promote prompt
**Files:** `src/app/dashboard/page.tsx` (the `handleAddProject` success path, ~line 1569).
- [ ] After a successful create (form reset, projects re-fetched), show a dismissible, **non-blocking** prompt: "🎉 Shipped [title]! Feature it on the banner? [Feature it] [Maybe later]" → "Feature it" routes to `/pricing?project=<newId>`. Must NOT block the free create flow.
- [ ] Note (do NOT implement blindly): the onboarding flow has a second create path (Plan 3 territory) — leave a `// TODO(plan-3): mirror post-publish prompt in onboarding` marker; do not wire it here.
- [ ] Verify: `tsc` + `eslint` + visual (create a project in the dashboard → prompt appears, dismissible, "Feature it" deep-links). Commit.

### Task 5: Soften the marquee
**Files:** `src/components/ui/promo-billboard-client.tsx` (CSS/visual only — no data/logic change).
- [ ] Calm the styling per spec: less-aggressive accent, lower height / smaller type, gentler scroll speed; keep it readable + clickable. Confirm it still pauses on hover and re-fetches on expiry (unchanged logic).
- [ ] Verify: `eslint` + visual (marquee reads as a tasteful strip, not a loud banner). Commit.

### Task 6: Clean up + full verify
- [ ] The homepage `<FeaturedCarousel/>` is already removed (#207). If `featured-carousel.tsx` / `featured-section.tsx` are now fully unused (the shelf reuses only `FeaturedProjectCard`, not `FeaturedSection`), leave them in place for now (a later polish/Plan 5 removes dead code) OR delete if clearly orphaned — your call, but do NOT break the buy card or shelf.
- [ ] Full gate: `tsc --noEmit` (no new errors), `eslint src`, `npm run build`. Visual pass: `/projects` shelf, `/pricing` checkout (buy card + preselect), dashboard "✦ Feature" + post-publish prompt, softened marquee.
- [ ] Confirm ownership still enforced: the buy still goes through the unchanged `/api/promotions` + `/api/solana/verify` gates. Commit.

---

## Dodo (fast-follow, NOT this plan)
The checkout (`FeatureYourProjectCard`) already branches by chain (`handlePromoteEVM` / `handlePromoteSolana`). A card option is **another handler** of the same shape (quote → pay → server-verify → grant) using the `dodo-webhook` + `pricing-page` skills, gated on the user providing a Dodo account + API keys. Keep the checkout's chain/rail selector structured so "Card" slots in beside Base/Solana.

## Self-review
- **Spec coverage:** ✦ shelf on /projects (Task 2) ✓ · softened marquee (Task 5) ✓ · promote entries: dashboard button + post-publish prompt + /projects nudge (Tasks 3, 4) ✓ · single rail-agnostic checkout (Task 1) ✓ · buy-flow gap closed (Task 1) ✓ · Dodo deferred but checkout kept rail-agnostic ✓.
- **No placeholders:** every task names exact files + reuses named existing components/endpoints.
- **Type/contract consistency:** `preselectedProjectId` prop (Task 1) is read via `?project=<id>` (Tasks 3, 4) consistently; `FeaturedShelf` takes enriched promotions from the same `fetchPromotions/enrichPromotions` used elsewhere.
- **Risk:** payment/grant/ownership code untouched (reused); changes are placement + one optional prop + CSS.

## Execution handoff
Subagent-driven on `feat/promotions-blend` (worktree). Given it's payments-*adjacent*, the spec-compliance + code-quality reviews per task must explicitly confirm **no change to payment execution or ownership gates**. Merge with/before #207 to avoid the buy-flow gap.
