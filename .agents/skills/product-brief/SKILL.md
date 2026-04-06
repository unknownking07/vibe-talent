---
name: product-brief
description: Write a one-page product brief before touching any code. Lighter than a full spec — just enough to know what you're building, who it's for, and what v1 does NOT include. Use when the user has a product idea, wants to scope a project, needs to clarify what they're building, or is about to start coding without a plan. Triggers on requests like "product brief", "what am I building", "scope this", "one-pager", "project brief", "clarify this idea", "before I start coding", "what should v1 look like", "help me think through this", or any mention of scoping, planning, or clarifying a product idea before implementation.
category: planning
tags: [product, brief, planning, scope, v1]
author: tushaarmehtaa
---

Write a one-page product brief before any code gets written. Lighter than `/mvp-spec`. One page. Forces clarity.

## Phase 1: Extract the Idea

Ask for anything you can't infer:

1. **What is this?** — One sentence. "It's a ___ that lets ___ do ___."
2. **Who is it for?** — One specific person, not a category. "Junior devs shipping their first SaaS" not "developers."
3. **Why does this need to exist?** — What's broken today? What do people currently do instead?
4. **What's the one thing it must do well?** — If it only does one thing, what is it?

If the user has already described the idea in conversation, extract these from context. Don't re-ask what you already know.

## Phase 2: Write the Brief

One page. Six sections. No fluff.

```
PRODUCT BRIEF — [Name]
════════════════════════════════════

WHAT IS THIS?
[One paragraph. What it does, in plain language. A stranger reads this and gets it.]

WHO IS IT FOR?
[One specific person. Name their situation, not their job title.
"A founder who just built something and needs to tell people about it"
not "entrepreneurs and marketers"]

THE PROBLEM
[What's broken right now. What people do today and why it sucks.
Be specific. "They spend 3 hours writing a landing page that converts at 0.5%"
not "marketing is hard"]

THE SOLUTION
[How this product fixes the problem. One paragraph.
Focus on the experience, not the implementation.
"You describe your product, get conversion-tested copy in 2 minutes"
not "AI-powered copywriting engine with fine-tuned models"]

V1 DOES:
- [thing it does]
- [thing it does]
- [thing it does]
- [thing it does]
(4-6 items. Each starts with a verb.)

V1 DOES NOT:
- [thing it won't do yet]
- [thing it won't do yet]
- [thing it won't do yet]
(3-5 items. This section is more important than the one above.
Saying no is how you ship.)

════════════════════════════════════
```

## Phase 3: The "Does Not" Test

The V1 DOES NOT section is the whole point of this skill. Vibe coders skip this and end up building for 3 months instead of 3 days.

**Prompt hard on this:**

- "You listed 8 features in V1 DOES. Which 3 can you cut and still have something useful?"
- "If you had to launch in one weekend, which features survive?"
- "What's the simplest version someone would actually pay for / use / share?"

The brief is not done until the DOES NOT list is at least half as long as the DOES list.

## Phase 4: Pressure-Test Questions

After writing the brief, ask these. If the user can't answer them, the idea isn't clear enough yet.

1. **Can you explain this to a friend in one sentence?** — If not, the WHAT section needs rewriting.
2. **Can you name one real person who would use this?** — Not a persona. A real human. If not, the WHO section is too vague.
3. **What do people use today instead?** — If "nothing," either the problem isn't real or you haven't found the workaround yet.
4. **What would make someone switch from the current solution?** — This is your differentiator. If you can't answer it, you don't have one.
5. **What's the first thing a user does after signing up?** — If this isn't obvious, your onboarding will fail.

## Phase 5: Output

Write the brief as a markdown file. Offer to save it as `BRIEF.md` in the project root.

If `/mvp-spec` would be useful as a next step (the idea is validated and needs full technical planning), say so. The brief comes first — the spec comes after.

## Verify

```
[ ] WHAT section is one paragraph a stranger understands
[ ] WHO section names a specific person, not a job title or category
[ ] PROBLEM section describes what people do today and why it fails
[ ] SOLUTION section describes the experience, not the implementation
[ ] V1 DOES list is 4-6 items, each starting with a verb
[ ] V1 DOES NOT list is at least half as long as V1 DOES
[ ] You can explain the whole product in one sentence
[ ] You can name one real person who would use this
[ ] Brief fits on one page — if it doesn't, cut until it does
```
