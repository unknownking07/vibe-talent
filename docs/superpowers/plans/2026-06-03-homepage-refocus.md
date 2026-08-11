# Homepage Refocus — Implementation Plan (Plan 1 of 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the unfocused, dual-audience homepage with the focused **fork-hero** layout (11 → 6 sections, ad-free), porting the already-verified `/preview-refocus` design into production.

**Architecture:** Port the visually-verified preview (`src/app/preview-refocus/`) into the real homepage + shared components. Extract the fork hero and animated scenes into `src/components/homepage/`. Reuse the existing data fetch (`fetchHomepageDataCached`) and the existing feed rendering. **No backend / scoring / payment changes.**

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript · Tailwind v4. Verification: `npx tsc --noEmit`, `./node_modules/.bin/eslint src`, `npm run build`, + visual check at `localhost:3000`.

**Sources of truth:** spec `docs/superpowers/specs/2026-06-03-product-refocus-design.md` (§1 IA, §2 hero, §5 nav/CTA) + the working preview `src/app/preview-refocus/page.tsx` and `src/app/preview-refocus/hero-scenes.tsx`.

**Note on testing:** This phase is a **UI refactor** — there is no new business logic, so the verification gate is *typecheck + lint + build clean, plus visual confirmation*, not unit tests. (Logic-heavy phases — onboarding checklist, achievement detection — get real unit tests in their own plans.) Commit after every task. The `/preview-refocus` route is **kept** as the porting source; it's deleted in Plan 5.

---

## File structure

| File | Action | Responsibility |
|---|---|---|
| `src/components/homepage/hero-scenes.tsx` | Create | Animated builder/hirer scenes (port from preview) |
| `src/components/homepage/fork-hero.tsx` | Create | Fork hero section: chip + clarity copy + 2 audience cards + stats strip |
| `src/app/page.tsx` | Modify | New 6-section composition; remove SPONSORED carousel; merge education → "How it works"; organic projects teaser; fix VibeFinder copy |
| `src/components/layout/navbar-client.tsx` | Modify | Trim primary nav (demote AI Agents + Docs) |
| `src/components/layout/signup-bar.tsx` | Modify | Suppress the duplicate sticky CTA on the homepage |
| `src/components/homepage/end-game-ladder.tsx` | (Unused by homepage) | Content folded into "How it works"; leave file, just stop importing |

---

### Task 0: Branch

- [ ] **Step 1: Create a feature branch** (repo rule: never commit to the default branch)

```bash
git checkout -b feat/homepage-refocus
```

---

### Task 1: Port animated hero scenes to a production component

**Files:** Create `src/components/homepage/hero-scenes.tsx`

- [ ] **Step 1: Copy the preview file verbatim** — copy the full contents of `src/app/preview-refocus/hero-scenes.tsx` into `src/components/homepage/hero-scenes.tsx`. Exports must stay: `HeroSceneStyles`, `BuilderScene`, `HirerScene`. It is already verified in the preview; **no logic change**. Replace the top "⚠️ THROWAWAY PREVIEW asset" comment with: `// Animated hero scenes (CSS only, prefers-reduced-motion safe) for the homepage fork hero.`

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit && ./node_modules/.bin/eslint src/components/homepage/hero-scenes.tsx && echo OK
```
Expected: `OK` (no type/lint errors).

- [ ] **Step 3: Commit**

```bash
git add src/components/homepage/hero-scenes.tsx
git commit -m "feat(homepage): add animated builder/hirer hero scenes"
```

---

### Task 2: Create the ForkHero component

**Files:** Create `src/components/homepage/fork-hero.tsx`

Port the fork-hero `<section>` from `src/app/preview-refocus/page.tsx` (the framing chip + H1/sub + the two `.p-7` audience cards + the stats strip), with these production changes baked in:

- [ ] **Step 1: Write the component** with this exact shape (port the two card bodies + stats markup from the preview; the props/copy below are the production deltas):

```tsx
import Link from "next/link";
import { HeroCTA } from "@/components/ui/hero-cta";
import { Flame, Code2, Target, Users, Check } from "lucide-react";
import { HeroSceneStyles, BuilderScene, HirerScene } from "@/components/homepage/hero-scenes";

interface ForkHeroProps {
  stats: { totalBuilders: number; totalProjects: number; avgStreak: number; topVibers: number };
}

export function ForkHero({ stats }: ForkHeroProps) {
  const statItems = [
    { label: "Active Builders", value: String(stats.totalBuilders), icon: Users },
    { label: "Projects Shipped", value: String(stats.totalProjects), icon: Code2 },
    { label: "Avg. Streak", value: `${stats.avgStreak} ${stats.avgStreak === 1 ? "day" : "days"}`, icon: Flame },
    { label: "Top Vibers", value: String(stats.topVibers), icon: Target },
  ];
  return (
    <section className="relative">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-12 pb-10">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 text-sm font-bold uppercase tracking-wide text-[var(--foreground)] mb-6"
               style={{ backgroundColor: "var(--bg-surface)", border: "2px solid var(--border-hard)", boxShadow: "var(--shadow-brutal-sm)" }}>
            <span>Proof of work, not résumés</span>
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight uppercase text-[var(--foreground)]">
            Vibe coders who <span className="text-accent-brutal">actually ship.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-[var(--text-secondary)] font-medium">
            VibeTalent gives developers a GitHub-verified track record — daily coding streaks, real
            shipped projects, and one Vibe Score — so the best get discovered and hired on proof, not résumés.
          </p>
        </div>

        <HeroSceneStyles />
        <div className="mt-10 grid gap-5 sm:grid-cols-2 max-w-4xl mx-auto stagger-children">
          {/* Builder card — port the preview's "I'm a builder" card body, with: */}
          {/*   <BuilderScene /> ; h2 "I'm a builder" ; "Build your reputation. Get discovered." ; */}
          {/*   3 Check bullets ; <HeroCTA className="mt-6 inline-flex w-full justify-center" /> */}
          {/* Hiring card — port the preview's "I'm hiring" card body, with: */}
          {/*   <HirerScene /> ; h2 "I'm hiring" ; "Hire vibe coders who actually ship." ; */}
          {/*   3 Check bullets ; <Link href="/explore" className="btn-brutal btn-brutal-secondary text-base mt-6 w-full justify-center inline-flex">Explore Talent</Link> */}
        </div>

        <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mx-auto">
          {statItems.map((s) => (
            <div key={s.label} className="text-center p-3"
                 style={{ backgroundColor: "var(--bg-surface)", border: "2px solid var(--border-hard)", boxShadow: "var(--shadow-brutal-sm)" }}>
              <s.icon size={18} className="mx-auto text-[var(--accent)] mb-1.5" />
              <div className="text-xl font-extrabold text-[var(--foreground)] font-mono">{s.value}</div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)] mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```
> Fill the two card bodies by copying them from `src/app/preview-refocus/page.tsx` (the `I'm a builder` / `I'm hiring` cards), swapping the `<BuilderScene/>`/`<HirerScene/>` in place of the old icons (already done in the preview) and keeping the `Check` bullet lists verbatim.

- [ ] **Step 2: Verify** — `npx tsc --noEmit && ./node_modules/.bin/eslint src/components/homepage/fork-hero.tsx && echo OK` → `OK`.

- [ ] **Step 3: Commit** — `git add src/components/homepage/fork-hero.tsx && git commit -m "feat(homepage): add fork hero with plain-language clarity copy"`

---

### Task 3: Rebuild the homepage composition (11 → 6 sections)

**Files:** Modify `src/app/page.tsx`

Do these as focused edits, then verify once at the end.

- [ ] **Step 3a — Swap the hero:** replace the entire `{/* Hero */}` `<section>` block with `<ForkHero stats={{ totalBuilders, totalProjects, avgStreak, topVibers: topVibecoders.length }} />`. Add `import { ForkHero } from "@/components/homepage/fork-hero";`. Remove imports now unused by the page (check each: keep `HeroCTA` only if still used by the final CTA — it is).
- [ ] **Step 3b — Kill the ad in the middle:** remove `<FeaturedCarousel />` and its import. (Paid featured moves to `/projects` in Plan 2.)
- [ ] **Step 3c — Merge education → "How it works":** remove the `{/* What is Vibe Coding */}` section, the `{/* Why Streaks Matter */}` section, and `<EndGameLadder />` (+ its import). In their place insert ONE "How it works" section — port it from `src/app/preview-refocus/page.tsx` (the `How it works` section: 3 steps + the badge ladder). 
- [ ] **Step 3d — Platform-now:** keep the feed section using the EXISTING conditional (`showFeedV2 ? <NetworkFeed variant="compact" .../> : <LiveActivityFeed />`) — **do not swap the feed component**. Keep the "Top Vibecoders" grid section right after it (this is "the platform right now").
- [ ] **Step 3e — Organic projects teaser:** keep the `{/* Featured Projects */}` section ("What are vibe coders building?") as an ORGANIC grid of `featuredProjects` with "See All → /projects". Do **not** add any `★ Featured`/SPONSORED treatment here (paid featuring lives on `/projects`, Plan 2).
- [ ] **Step 3f — Fix VibeFinder copy:** in the final `{/* CTA */}` section, replace the sentence `"...let VibeFinder Bot match you with clients."` with `"...and let your proof of work get you discovered."` (drop the unexplained "VibeFinder Bot").
- [ ] **Step 3g — Leave Testimonials + FAQ untouched** (all 6 FAQ items + the FAQPage JSON-LD stay).

- [ ] **Step 3h — Verify**

```bash
npx tsc --noEmit && ./node_modules/.bin/eslint src && npm run build
```
Then `npm run dev`, open `localhost:3000`, and confirm in order: fork hero → How it works → feed + top builders → organic "what vibe coders are building" → testimonials → all 6 FAQs → final CTA (no "VibeFinder"). Confirm the SPONSORED carousel is **gone**.

- [ ] **Step 3i — Commit** — `git add src/app/page.tsx && git commit -m "feat(homepage): refocus to 6-section fork layout, remove sponsored carousel"`

---

### Task 4: Trim the navbar

**Files:** Modify `src/components/layout/navbar-client.tsx`

- [ ] **Step 1:** Read the file. Reduce the **primary** nav links to the core three: **Explore, Leaderboard, Feed**, plus the existing **Create Profile / Dashboard** button and the theme toggle. Move **AI Agents** and **Docs** into a "More ▾" overflow menu (keep both routes reachable — just not in the top bar). Mirror the change in the mobile menu if it lists links separately.
- [ ] **Step 2: Verify** — `npx tsc --noEmit && ./node_modules/.bin/eslint src/components/layout/navbar-client.tsx`; visually confirm fewer primary links + the overflow menu works on desktop and mobile.
- [ ] **Step 3: Commit** — `git commit -am "feat(nav): trim primary nav, move AI Agents + Docs into overflow"`

---

### Task 5: Remove the duplicate persistent CTA on the homepage

**Files:** Modify `src/components/layout/signup-bar.tsx`

- [ ] **Step 1:** The sticky "Get discovered" bar duplicates the hero's primary CTA on `/` (and overlapped the hero buttons in testing). Suppress it on the homepage only: in the client signup-bar component, read the route with `import { usePathname } from "next/navigation";` and early-return `null` when `usePathname() === "/"`. Leave it on every other route.
- [ ] **Step 2: Verify** — visual: the bar is absent on `/`, still present on e.g. `/leaderboard` and `/projects`.
- [ ] **Step 3: Commit** — `git commit -am "fix(homepage): hide redundant signup bar on landing (hero owns the CTA)"`

---

### Task 6: Full verification pass

- [ ] **Step 1:** `npx tsc --noEmit` → no errors
- [ ] **Step 2:** `./node_modules/.bin/eslint src` → clean
- [ ] **Step 3:** `npm run build` → succeeds
- [ ] **Step 4: Visual acceptance** at `localhost:3000` against the spec's homepage criteria: (a) the 5-second clarity test — a newcomer can say what VibeTalent is from the hero alone; (b) no standalone SPONSORED block; (c) ~6 sections, one narrative; (d) all 6 FAQs present; (e) one primary CTA per audience (no duplicate sticky bar).
- [ ] **Step 5:** Commit any fixes.

---

## Self-review

**Spec coverage (Plan 1 scope = spec §1, §2, §5 homepage parts):**
- §2 fork hero + clarity copy + scenes → Tasks 1, 2, 3a ✅
- §1 IA 11→6 (remove carousel, merge education, organic projects) → Tasks 3b–3e ✅
- §5 nav trim → Task 4 ✅ · one persistent CTA → Task 5 ✅ · VibeFinder copy → Task 3f ✅
- Deferred correctly to later plans: `/projects` ✦ shelf + marquee softening (Plan 2), onboarding (Plan 3), share loop (Plan 4), app-wide hierarchy + mobile + empty/error + delete preview (Plan 5).

**Placeholder scan:** Card bodies in Task 2 are an explicit *port-from-this-file* reference (the verified preview), not a vague placeholder — the source lines exist and are named. Nav change (Task 4) is a read-then-modify with an exact target end-state. No "TBD"/"handle edge cases".

**Type consistency:** `ForkHero` prop is `stats: {totalBuilders, totalProjects, avgStreak, topVibers}`; `page.tsx` (Task 3a) passes exactly those keys (`topVibers: topVibecoders.length`). Scene exports (`HeroSceneStyles/BuilderScene/HirerScene`) match between Task 1 and Task 2.

---

## Execution handoff

Plan complete. Before executing: this is a **large change to the live homepage**, and per the repo's hackathon/demo-day caution, confirm timing with the user first. Nothing is committed or built yet.
