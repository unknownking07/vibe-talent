# VibeTalent style lock

Locked 2026-08-11 (premium-minimal pass, replacing the neo-brutalist system).
Reuse these tokens for every new screen/component. Do not re-derive.

## Identity (unchanged, preserved)
- Font: Space Grotesk (display + body), JetBrains Mono for numbers/stats/terminal motifs.
- Accent: `#FF3A00` (hover `#E03300`), single accent — no second hue.
- Dark mode: warm greys, hue ~14° (never neutral grey). Light mode: warm off-white `#F6F4F2`, white surfaces.

## Surface language
- Borders: 1px only. `var(--border-subtle)` default, `var(--border-hard)` emphasis. Never 2px (exception: dashed upload dropzones).
- Radius scale (locked): cards/panels/modals 16px (`rounded-2xl` / `--radius-card`), buttons/inputs/menus 12px (`rounded-xl` / `--radius-control`), chips/tags/pills/avatars full (`rounded-full`), tiny nested 8px (`rounded-lg`).
- Shadows: only `--shadow-brutal(-xs/-sm//-hover/-accent)` — soft layered, warm-tinted. No hard offset shadows anywhere.
- De-box rule: a border/box must earn its place. Grouping inside a card = spacing or `divide-y` hairlines, not another box. Stat rows are open (icon + number + label), never tiles.

## Icons
- **Phosphor** (`@phosphor-icons/react`) for anything expressive: stat glyphs,
  feature/section icons, empty states, verification badges. Server components must
  import from `@phosphor-icons/react/dist/ssr`; client components from the root entry.
- **Lucide stays** for functional chrome only: X, chevrons, arrows, ExternalLink,
  Copy, Search, spinners, Trash/Edit/Settings/LogOut.
- Weights: `fill` at ≤28px, `duotone` at ≥32px (big empty-state/feature art),
  `bold` for line-drawn glyphs (Check, Pulse, GitCommit, TrendUp). Never leave a
  Phosphor icon at default weight — hairline outlines are the look we removed.
- Accent colour is reserved for brand metrics (streak Fire, vibe Lightning) and
  icons already sitting inside an accent tile. Other glyphs: `--text-muted-soft`.
- Icon maps typed with `import type { Icon } from "@phosphor-icons/react"`, never
  `LucideIcon`, or the `weight` prop won't type-check.
- Never mix families inside one visual cluster (a stat row, a tile grid).

## Copy
- **Zero em dashes (—) and separator en dashes (–) in user-visible copy.** Rewrite
  per sentence: comma before a contrast ("not", "but"), period before an
  independent clause, colon before a list or definition. Ranges use a hyphen.
  Code comments keep theirs — they aren't user-visible.

## Type voice
- Headings (h1/h2/h3) are UPPERCASE — global rule in globals.css (owner's call,
  2026-08-11). The punch lives in the type, not in boxes. Escape hatch: `normal-case`.
  Card titles that aren't real `<h*>` elements get the `uppercase` class to match.
- Everything else sentence case: buttons, labels, nav, body. No tracking-wide micro-labels.
- Micro-labels: `text-xs font-medium text-[var(--text-muted)]`.
- Weights: semibold for labels/buttons, bold for headings, extrabold only on display headlines (text-3xl+) and big stat numerals.

## Motion
- Easing: `var(--ease-out)` = cubic-bezier(0.23, 1, 0.32, 1), 140–200ms.
- Buttons: hover -1px lift, active scale(0.98) (built into `.btn-brutal`).
- Interactive cards: `hover:-translate-y-0.5 hover:shadow-[var(--shadow-brutal-hover)]`.
- Never the old "press-in" translate-down-right hover.

## Legacy naming
`*-brutal` class/var names were kept (60+ files reference them) but their values are
the new language. Rename opportunistically, never mix in new hard-offset values.

## Deliberately not migrated (still bold/brutal on purpose or deferred)
- `src/app/api/share-card`, `/api/og`, `opengraph-image.tsx` (Satori share images — fragile, separate surface).
- Email templates (`email-preview`, `lib/email.ts`).
- `auth/signup`, `auth/profile-setup`, `settings` pages — blocked on the username WIP branch; restyle after it lands.
