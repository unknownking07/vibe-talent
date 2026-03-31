---
name: app-copy
description: Audit or generate all UI microcopy for an app — empty states, error messages, loading states, onboarding flows, tooltips, button labels, confirmation dialogs, and success messages. Use when the user wants to write UI copy, fix empty states, improve error messages, audit UX writing, make their app feel polished, or replace placeholder text. Triggers on requests like "write app copy", "fix my empty states", "error messages", "UI copy", "microcopy", "UX writing", "my app feels robotic", "placeholder text", "button labels", "onboarding copy", "toast messages", or any mention of in-app text, UI writing, or product copy.
category: workflow
tags: [microcopy, ux-writing, ui-copy, empty-states, onboarding]
author: tushaarmehtaa
---

Audit existing UI copy or generate all microcopy for an app in one pass. Output is a copy doc organized by screen and interaction type.

## Phase 1: Determine Mode

**Audit mode** — codebase exists. Scan for hardcoded strings, placeholder text, generic messages. Score and rewrite.

**Generate mode** — user describes the app. Build a complete copy doc from scratch.

**How to scan:** Read page components, look for:
- Strings in JSX/TSX (`<p>`, `<h1>`, button text, placeholder attrs)
- Toast/notification messages (search for `toast(`, `notify(`, `alert(`)
- Error boundaries and catch blocks
- Empty state components (search for "empty", "no results", "nothing here", "get started")
- Loading text (search for "loading", "please wait", skeleton components)
- Form validation messages
- Modal/dialog copy

Gather before writing:
- What does the app do? (one sentence)
- What's the brand voice? (casual/professional/playful/minimal)
- Who is the primary user?

If the codebase tells you, don't ask.

## Phase 2: The 8 Copy Categories

Score each 1–10 in audit mode. Use as a generation checklist in generate mode.

**Empty States (15%)** — what users see before they've done anything. This is where most apps fail. An empty state must: explain what will appear here, show how to create it, feel inviting not blank. "No items yet" is a 1/10.

**Error Messages (15%)** — what broke, why, and what to do next. Three parts: (1) what happened, (2) why, (3) what to do now. Never blame the user. Never be vague. "Something went wrong" is a 1/10.

**Button Labels (15%)** — every button must finish the sentence "I want to ___." "Submit" fails this test. "Save draft", "Send invite", "Create project" pass it.

**Onboarding (15%)** — first-run experience. Welcome message, setup steps, first action prompt. Must reduce time-to-value. Don't explain features — guide the first action.

**Loading & Progress (10%)** — what happens during waits. Skeleton screens > spinners > "Loading..." For long operations, show progress and what's happening. "Processing your data" beats a spinner.

**Success Messages (10%)** — confirmation that something worked. Specific: "Invoice sent to alex@company.com" not "Success!" Include the next action when relevant.

**Tooltips & Help Text (10%)** — contextual guidance. Answer the question the user is thinking right now. Keep under 15 words. If you need more, link to docs.

**Confirmation Dialogs (10%)** — destructive actions need clear stakes. State what will happen, what can't be undone, and make the primary action match the verb. "Delete 3 projects" not "Are you sure? [OK] [Cancel]"

## Phase 3: Voice Calibration

Before writing any copy, establish the voice:

**Casual** (Slack, Notion) — contractions, lowercase, humor where appropriate. "you're all set!" / "nothing here yet — create your first project"

**Professional** (banking, healthcare, enterprise) — proper capitalization, no humor, precise language. "Your transfer has been initiated." / "No records found. Use the search filters above."

**Playful** (Duolingo, Mailchimp) — personality-forward, emoji ok, character voice. "High five! You nailed it!" / "Your inbox is lonely. Send your first campaign!"

**Minimal** (Linear, Vercel) — fewest words possible, no filler, stark. "No issues" / "Deployed" / "Saved"

**Default to casual unless the product clearly demands otherwise.** Most indie/vibe-coded products benefit from casual.

## Phase 4: Empty State Rules

Empty states are the most neglected copy in any app. They're also the first thing new users see.

**Structure:**
```
[Illustration or icon — optional but effective]
[Headline — what will appear here]
[Subtext — how to create the first one]
[CTA button — the action to take]
```

**Good examples:**
```
No projects yet
Create your first project to get started.
[+ New Project]

No messages
When someone messages you, it'll show up here.

Your dashboard is empty
Connect your first data source to see metrics.
[Connect Data Source]
```

**Bad examples:**
```
No data                    ← says nothing
Nothing to show            ← no guidance
0 results found            ← database language, not human language
No items match your search ← ok but add "Try different keywords"
```

## Phase 5: Error Message Rules

Every error has three jobs: say what happened, say why, say what to do.

**Formula:** `[What happened]. [Why / context]. [What to do next].`

```
Couldn't save your changes. The server didn't respond. Try again in a few seconds.

That email is already registered. Sign in instead?

File too large. Max size is 10MB. Try compressing the image first.

Payment failed. Your card was declined. Update your payment method to continue.
```

**Never write:**
- "Something went wrong" (what went wrong?)
- "Invalid input" (which input? what's wrong with it?)
- "Error 500" (meaningless to users)
- "Please try again later" (when is later?)
- "An unexpected error occurred" (all errors are unexpected)
- "Oops!" before serious errors (payment failure is not cute)

## Phase 6: Button & CTA Rules

Every button finishes the sentence "I want to ___."

**Pair the button with what it does, not what it is:**

```
"Save changes"        ← what it does
"Submit"              ← what it is (bad)

"Send invitation"     ← specific action
"Confirm"             ← vague (bad)

"Delete account"      ← clear stakes
"OK"                  ← unclear stakes (bad)

"Start free trial"    ← value clear
"Get Started"         ← started with what? (bad)
```

**Destructive buttons** must name the action: "Delete project", "Remove member", "Cancel subscription." Never just "Delete" or "Remove" without the object.

## Phase 7: Output Format

### Audit output:

```
APP COPY AUDIT — [product]
════════════════════════════════════
Empty States         [X/10]  [one-line note]
Error Messages       [X/10]  [one-line note]
Button Labels        [X/10]  [one-line note]
Onboarding           [X/10]  [one-line note]
Loading & Progress   [X/10]  [one-line note]
Success Messages     [X/10]  [one-line note]
Tooltips & Help      [X/10]  [one-line note]
Confirmations        [X/10]  [one-line note]
────────────────────────────────────
Overall              [X/80]
════════════════════════════════════

REWRITES (worst 3 categories):

[Category] — [file:line]
  Before: "[original text]"
  After:  "[rewritten text]"
```

### Generate output:

Organized by screen/component. Each entry:

```
[Screen Name]
  empty state:   "[copy]"
  error:         "[copy]"
  success:       "[copy]"
  buttons:       "[label1]" / "[label2]"
  placeholder:   "[copy]"
```

**After generating, offer to write the copy directly into the codebase** — find the components and replace strings in place.

## Verify

```
[ ] Every empty state explains what will appear and how to create it
[ ] Every error message has: what happened + why + what to do next
[ ] Every button passes the "I want to ___" test
[ ] No "Submit", "OK", "Confirm", "Click here", "Learn more" without context
[ ] No "Something went wrong" or "An error occurred" anywhere
[ ] No "Loading..." as the only loading indicator
[ ] Success messages are specific — name the thing that was created/sent/saved
[ ] Destructive buttons name the object being destroyed
[ ] Voice is consistent across all copy (same tone, same casing, same punctuation)
[ ] No lorem ipsum, placeholder text, or TODOs left in the codebase
```
