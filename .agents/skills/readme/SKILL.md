---
name: readme
description: Audit an existing GitHub README or generate one from scratch. Scores structure, clarity, install instructions, and visual appeal. Use when the user wants to write a README, improve their README, add badges, fix documentation, or make their open source project look professional. Triggers on requests like "write a README", "improve my README", "audit my docs", "my README sucks", "add badges", "make my repo look good", "documentation", "README template", or any mention of GitHub documentation or project README files.
category: workflow
tags: [readme, documentation, github, open-source, developer-experience]
author: tushaarmehtaa
---

Audit an existing README or generate one from scratch. Output is a README.md ready to commit.

## Phase 1: Determine Mode

**Audit mode** — README.md exists in the project root. Score 8 dimensions, rewrite the weakest sections.

**Generate mode** — no README.md, or user explicitly asks to write one from scratch.

Gather anything missing before writing:

- What does this project do? (one sentence a stranger would understand)
- Who is it for? (specific audience, not "developers")
- How do you install it? (exact commands)
- How do you use it? (simplest possible example)

If you can answer these by reading the codebase, do that instead of asking.

## Phase 2: The 8 Dimensions

Score each 1–10 in audit mode. Use as a writing checklist in generate mode.

**Name & Description (15%)** — Project name is clear. First paragraph explains what it does in plain language. A stranger can understand it in 5 seconds.

**Visual Hook (10%)** — Logo, banner, screenshot, or GIF above the fold. Something visual that shows what the project looks like or does. No visual = automatic 1/10.

**Badges (5%)** — Build status, version, license, download count. Use shields.io. Don't overdo it — 3-6 badges max.

**Install (20%)** — Copy-pasteable commands. Covers npm/yarn/pnpm or equivalent. Prerequisites listed if any. Works on first try.

**Usage (20%)** — Minimal working example. Shows expected output. A new user can go from install to "it works" in under 60 seconds.

**API / Features (10%)** — Key features or API surface listed. Not exhaustive — just enough to know what's possible. Link to full docs if they exist.

**Contributing (10%)** — How to set up the dev environment. How to run tests. Where to report bugs. Makes a first contribution feel approachable.

**License (10%)** — License specified clearly. If missing, flag it — unlicensed code is legally unusable.

## Phase 3: Structure Rules

The order that works. Don't rearrange without reason.

```
# Project Name

[one-line description]

[badges row]

[screenshot / GIF / banner]

## Install

[copy-paste commands]

## Usage

[minimal example with expected output]

## Features

[bullet list — benefit-first, not feature-first]

## API

[if applicable — key methods/endpoints]

## Contributing

[setup + test commands + link to issues]

## License

[license name + link]
```

**Rules that don't move:**

- **First paragraph is everything.** If someone reads nothing else, this paragraph must explain what the project does and who it's for.
- **Install must be copy-pasteable.** No "configure your environment" hand-waving. Exact commands.
- **Usage example must be minimal.** The simplest possible thing that shows it working. Not a full app — a 3-5 line snippet.
- **Screenshot or GIF above the fold.** If the project has a UI, show it. If it's a CLI, show terminal output. If it's a library, show the code + output side by side.
- **No wall of text.** Short paragraphs. Bullet points. Code blocks. A README is scanned, not read.
- **Features lead with benefit.** "Generate OG images automatically" not "Dynamic Open Graph Image Generation Module."

## Phase 4: The One-Line Description

The hardest part. One sentence under 15 words.

**Formulas:**

- "[Verb] [thing] [benefit]" — "Generate changelogs from git history"
- "[Thing] that [does what]" — "CLI that audits your SEO in 30 seconds"
- "[Outcome] for [audience]" — "Type-safe API routes for Next.js"

**Test it:** paste the one-liner into a Slack message with no other context. Does the recipient understand what the project does? If not, rewrite.

## Phase 5: Badges

Use shields.io. Pick from:

```markdown
![npm version](https://img.shields.io/npm/v/PACKAGE)
![license](https://img.shields.io/github/license/USER/REPO)
![build](https://img.shields.io/github/actions/workflow/status/USER/REPO/WORKFLOW)
![downloads](https://img.shields.io/npm/dm/PACKAGE)
```

**3-6 badges.** More than that is noise. Order: build status, version, downloads, license.

For non-npm projects, adapt: PyPI, crates.io, Go pkg, Docker pulls — whatever fits.

## Phase 6: Audit Output Format

```
README AUDIT — [project]
════════════════════════════════════
Name & Description   [X/10]  [one-line note]
Visual Hook          [X/10]  [one-line note]
Badges               [X/10]  [one-line note]
Install              [X/10]  [one-line note]
Usage                [X/10]  [one-line note]
API / Features       [X/10]  [one-line note]
Contributing         [X/10]  [one-line note]
License              [X/10]  [one-line note]
────────────────────────────────────
Overall              [X/80]
════════════════════════════════════

TOP 3 REWRITES:

[Section]: [what's wrong]
→ [rewritten version]
```

## Verify

```
[ ] One-line description under 15 words — a stranger gets it
[ ] Screenshot, GIF, or banner visible above the fold
[ ] Install commands copy-paste and work on first try
[ ] Usage example is under 10 lines and shows expected output
[ ] Features lead with benefit, not feature name
[ ] No wall of text — short paragraphs, bullets, code blocks
[ ] License specified
[ ] Badges use shields.io with real endpoints
[ ] README is under 300 lines — link to full docs for the rest
[ ] Read it like a stranger — does it make you want to try this?
```
