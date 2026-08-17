# VibeTalent — Product Refocus (Landing · Onboarding · Promotions)

**Design doc · 2026-06-03**
**Status:** Approved direction; pending spec review → implementation plan.

---

## Why this exists

Advisor feedback (Meta Alchemist) plus a focus audit found the product reads as "all over the place":

- The **landing page can't decide who it's for** — the hero headline speaks to hirers, the primary button to builders, the sticky bar to builders again.
- **Promotions feel bolted-on** — a "SPONSORED" carousel dropped in the middle of the homepage, before the page has even explained what the site is.
- **Onboarding front-loads friction** — a 4-step mandatory wizard (GitHub + 2 socials required) before any value, then an empty dashboard with guidance only behind a feature flag.

This spec consolidates the redesign that makes VibeTalent **focused, instantly understandable, and product-blended** — **without** touching the underlying scoring/streak/payment engines.

## North-star principles → acceptance criteria

These are hard rules to check the build against, not aspirations:

1. **Instantly understandable.** A first-time visitor can answer *"what is this · who's it for · what do I do"* after reading only the hero — no jargon decoding.
2. **Nothing bolted-on.** Every feature (promotions, onboarding, featured) lives inside the natural product flow. No standalone "ad" blocks.

## Scope

**In scope:** homepage IA + hero, featured-promotions placement + promote flow, builder onboarding redesign, the achievement → share loop, cross-cutting UX fixes (nav, visual hierarchy, mobile, empty/error states).

**Out of scope (future phases — see end):** Dodo/fiat payments, demand-side (hirer) product & monetization, deeper per-page UX redesign (profile/dashboard/hire/settings), private-repo GitHub App, score anti-gaming.

## Already shipped this session (real code, not preview)

- Weekly leaderboard skeleton loading — `src/components/leaderboard/weekly-tab.tsx`
- `/projects` sort-dropdown custom chevron — `src/components/projects/projects-content.tsx`
- Activity-feed skeletons — `src/components/ui/live-activity-feed.tsx`, `src/components/feed/network-feed.tsx`

---

## 1. Homepage information architecture (11 → 6 sections)

The homepage collapses to one narrative — **Hook → How → Proof → Builds → Convert** — and carries **zero paid-ad pressure**.

| New order | Section | Notes |
|---|---|---|
| 0 | **Marquee** (global, all pages) | Kept but **softened** (calmer than the loud orange ticker) |
| 1 | **Fork hero** + stats strip | See §2 |
| 2 | **How it works** | Merges the old "What is vibe coding" + "Why streaks matter" + "End-game ladder"; badge ladder folded in |
| 3 | **The platform right now** | Live feed + top builders (merges two old sections) |
| 4 | **What vibe coders are building** | **Organic** "recent builds → see all `/projects`" teaser — no paid/featured emphasis here |
| 5 | **Testimonials + FAQ + CTA** | All **6 FAQs** retained (+ `FAQPage` schema); single "Start your streak" CTA |

Removed/merged: the SPONSORED carousel (→ `/projects`, see §3), duplicate "featured projects" surface, repeated education (3×→1×) and social proof (4×→2×).

## 2. Hero — explicit fork + plain-language clarity

The hero stops contradicting itself and passes the 5-second test.

- **Chip:** `Proof of work, not résumés`
- **H1:** `Vibe coders who actually ship.`
- **Sub (clarity line):** *"VibeTalent gives developers a GitHub-verified track record — daily coding streaks, real shipped projects, and one Vibe Score — so the best get discovered and hired on proof, not résumés."* — defines the concept, the signals, and the payoff in one human sentence.
- **Two-path fork** (visitor self-selects):
  - **I'm a builder** → *Build your reputation. Get discovered.* → primary CTA **Create your profile**
  - **I'm hiring** → *Hire vibe coders who actually ship.* → **Explore talent** (→ `/explore`)
- **Animated on-brand scenes** replace the line icons, one per card, in the brutalist style (CSS only, no libraries, `prefers-reduced-motion` fallback):
  - Builder: a "shipping" editor — hooded-coder avatar, typing cursor, flickering streak flame, contribution graph filling.
  - Hirer: a "talent scanner" — profile rows, a sweep line landing on a match (highlight + checkmark).
- **Stats strip** (Active Builders / Projects / Avg Streak / Top Vibers) stays.

## 3. Featured promotions — blended

### 3a. Display (where featured projects are *seen*)
- **Primary: a `✦ Featured` shelf at the top of `/projects`** — 1–3 paid spots above the browse grid, **never touched by the user's search/sort/filter**. Same card shape as organic projects, just a subtle tag (App Store / Product Hunt pattern).
- **Marquee** — kept, softened; secondary always-on glance.
- **Homepage** — **no paid emphasis**; the projects section is an organic "recent builds" teaser.

### 3b. Promote flow (where a builder *buys* a feature)
Discovery entry points, most discoverable first:
1. **Post-publish prompt (primary):** right after a project is published, a dismissible, non-blocking card — *"🎉 Shipped [Project]! Feature it on the banner? → [Feature it] [Maybe later]"*. The free listing flow stays free; the prompt only fires on success.
2. **"Feature this project"** buttons on the builder's own projects (dashboard + project cards) — for existing projects.
3. **"Want your build featured? →"** nudge near the `/projects` shelf.

All entry points → **`/pricing`** (pick placement: banner / `✦` shelf + duration) → payment → grant via the `featured_promotions` registry (verify ownership before honoring). Today: USDC. Fiat (Dodo) is a later phase — both rails must converge on one "grant featured" path.

> Copy fix: FAQ #6 currently says you "pin a project to the homepage carousel" — update to the new blended placement and current payment options.

## 4. Onboarding — progressive (checklist-driven)

Replaces the 4-step mandatory wizard. Goal: minimum time-to-value, guidance in context.

- **Signup — strip to essentials.** Primary **"Continue with GitHub"** (one click; auto-pulls username + avatar; verifies GitHub on the spot — also removes the "GitHub buried at step 2" + "already linked" confusion). Fallbacks: Google / email. **Only required field: username** (pre-filled from GitHub). → Land on the dashboard immediately.
- **Dashboard "Get discovered" checklist** (persistent; **replaces the flag-gated tour**):
  - ✅ Profile created
  - ☐ **Connect GitHub** — *"Your commits power your streak & verify your projects. Without it, nothing counts."* (auto-✓ for GitHub signups)
  - ☐ **Ship your first build** — *"Shipped projects raise your Vibe Score and show clients what you build."* → flows into the post-publish promote prompt
  - ☐ **Keep your streak 🔥** — *"Commit to GitHub any day to keep it alive — a long streak is your unfakeable resume."* (auto-✓ when first commit syncs)
  - ☐ *(optional)* Add a contact (X / Telegram) so clients can reach you
  - Each item leads with the **why**; items auto-check from real signals; collapses to "✅ You're set — keep shipping" when done.
- **Relax the hard mandatory-socials gate** — socials become an optional checklist item, not a dashboard-blocking redirect.

## 5. Cross-cutting UX fixes

- **Navbar:** trim to essentials; demote Docs / AI Agents (currently 6 links + 2 buttons compete with the core action).
- **Visual hierarchy:** the brutalist treatment (hard borders + orange) is applied to *everything*, so nothing leads. Reserve it for the **one** primary action per screen; soften secondary elements (warm greys, lighter borders). Biggest "feels overwhelming" lever.
- **One persistent CTA:** the sticky bottom signup bar competes with the hero CTA (and overlaps content). Keep one.
- **"VibeFinder Bot":** named in the homepage CTA + tour but never explained — explain it or remove the mention.
- **Mobile:** density pass — 6 loud stacked sections is heavy on the device most social traffic uses.
- **Empty / error states:** recovery path for GitHub "already linked"; surface project-verification failures instead of a silent "unverified" badge.

## 6. Achievement → share loop (growth)

The streak/badge system already computes milestones and a shareable card exists (`/api/share-card/[username]`, shown via `ShareCardModal` from the profile sidebar) — but it's **passive**: a buried manual button, Download/Copy only, no social share, and nothing fires when you earn something. This turns the existing pieces into a viral growth loop. (Scope: **meaningful milestones**, each fires **once**, never a daily nag.)

**Trigger moments:**
- **Badge unlocks** — Bronze (30) / Silver (90) / Gold (180) / Diamond (365); thresholds in `src/lib/streak.ts` (`BADGE_THRESHOLDS`).
- **Key streak numbers** — 7 / 30 / 100 (configurable list).
- **First project shipped.**
- **Entering leaderboard top ranks** — e.g. Top 10 / #1 this week.

**Celebratory moment** (center-screen, on the dashboard):
- Fires after the dashboard's daily GitHub sync computes the new streak, and right after shipping a project.
- *"🎉 You unlocked Bronze — 30-day streak!"* + confetti + the achievement's shareable card.
- Actions: **Share to X** (primary) · Copy card · Download · Dismiss.

**Share mechanism — the growth multiplier:** a **one-tap X intent** with pre-filled copy + the builder's profile link (which unfurls the card as its OG image), replacing today's download-only friction. Default copy e.g. *"🔥 Just hit a 30-day streak on @vibetalentwork — Bronze unlocked. Proof of work > résumés. [profile]"*. (Keep Copy/Download as fallbacks; structure so other networks can be added later.)

**Per-achievement card:** extend `/api/share-card/[username]?achievement=<key>` so the card *features* the unlock rather than a generic profile.

**Detection (low-risk):** compare current `badge_level` / streak / rank against a stored *"already-celebrated"* record — a small `acknowledged_achievements` table (or localStorage for an MVP) — and fire each milestone **once**. **No writes to the locked reputation columns** (RLS/DEFINER stay untouched).

**Tact:** meaningful milestones only; never daily — avoids banner-blindness where users dismiss reflexively.

## Throwaway preview

`src/app/preview-refocus/` (+ `hero-scenes.tsx`) is a **non-production** preview built to align on this design. **Delete it once the real build lands.**

## Risks / open questions

- **Demand side (hirers) is thin.** The fork hero promises hiring; that promise needs a real hirer experience behind it (future phase). Until then, the builder side carries the product.
- **Score gameability** (commit-farming) and **public-only GitHub** (excludes private/pro work) undermine trust — future work.
- **Payments are high-risk** — fiat is deliberately a separate phase.

## Future phases (explicitly deferred)

1. **Dodo fiat payments** — card checkout (Merchant of Record, global cards + tax) alongside USDC on `/pricing`; signed/idempotent webhook → shared "grant featured" path.
2. **Demand-side** product + monetization (the scale play — buyers pay: recruiter access, job posts, intro fees, company-bought featured slots).
3. **Deeper per-page UX** (profile, dashboard, leaderboard, hire, settings) to the same blended/clear standard.
4. **Private-repo GitHub App** + **score anti-gaming**.

## Acceptance criteria (check the build against these)

- [ ] **5-second clarity:** a non-user can paraphrase what VibeTalent is + who it's for + the first action, from the hero alone.
- [ ] **No bolted-on ads:** promotions appear only inline (`/projects` shelf, softened marquee, in-flow prompts) — no standalone SPONSORED block.
- [ ] Homepage is ~6 sections, one narrative, one primary action per audience.
- [ ] A new builder reaches the dashboard with **≤1 required field**; the checklist guides the rest, no hard socials gate.
- [ ] All **6 FAQs** + `FAQPage` schema retained.
- [ ] No layout shift on feed / leaderboard / projects loads (skeletons in place).
- [ ] `prefers-reduced-motion` respected by hero scenes.
- [ ] Featured promotions still verify ownership before honoring; no change to scoring/streak math.
- [ ] Crossing a milestone (badge / key streak / first project / top rank) fires a **one-time** celebratory share moment with a **one-tap "Share to X"**; never repeats, never fires daily; no writes to reputation columns.
