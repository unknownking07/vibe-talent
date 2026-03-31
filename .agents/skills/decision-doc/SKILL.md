---
name: decision-doc
description: Write a structured decision document when stuck between two or more approaches. Lays out options, tradeoffs, constraints, and picks one. Use when the user is debating architecture, choosing between tools, weighing tradeoffs, or stuck in analysis paralysis. Triggers on requests like "decision doc", "should I use X or Y", "help me decide", "which approach", "tradeoff analysis", "I'm stuck between", "pros and cons", "compare these options", "what should I pick", "architecture decision", or any request to choose between multiple approaches, tools, or implementations.
category: planning
tags: [decision, tradeoffs, architecture, planning, analysis]
author: tushaarmehtaa
---

Write a decision doc when you're stuck between approaches. Forces a pick instead of endless deliberation.

## Phase 1: Frame the Decision

Get these from the user or extract from conversation:

1. **What's the decision?** — One sentence. "Which auth provider to use" not "thinking about auth stuff."
2. **Why now?** — What's blocked until this is decided? Urgency changes the answer.
3. **What are the options?** — 2-4 options. More than 4 means you haven't filtered enough.
4. **What are the constraints?** — Budget, timeline, team size, existing tech, non-negotiables.

If the user says "I'm stuck between X and Y," you already have 1 and 3. Don't re-ask.

## Phase 2: Define the Criteria

Before comparing options, agree on what matters. Ask the user to rank these or suggest your own based on context:

**Common criteria (pick 3-5 that matter for this decision):**

- Time to implement
- Long-term maintenance burden
- Cost (money)
- Team familiarity / learning curve
- Scalability / performance
- Flexibility to change later
- Community / ecosystem / docs
- User experience impact
- Security implications
- Reversibility — how hard is it to switch if this is wrong?

**Reversibility is the tiebreaker.** When two options are close, pick the one that's easier to undo. Irreversible decisions deserve more deliberation. Reversible ones deserve speed.

## Phase 3: Write the Doc

```
DECISION — [title]
════════════════════════════════════

CONTEXT
[2-3 sentences. What we're building, why this decision matters now,
what's blocked until we decide.]

CONSTRAINTS
- [constraint 1]
- [constraint 2]
- [constraint 3]

OPTIONS

┌─────────────────────────────────────────────┐
│ Option A: [name]                            │
├─────────────────────────────────────────────┤
│ How it works: [1-2 sentences]               │
│ Upside: [strongest argument]                │
│ Downside: [strongest argument against]      │
│ Effort: [S/M/L]                             │
│ Reversibility: [easy/medium/hard]           │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ Option B: [name]                            │
├─────────────────────────────────────────────┤
│ How it works: [1-2 sentences]               │
│ Upside: [strongest argument]                │
│ Downside: [strongest argument against]      │
│ Effort: [S/M/L]                             │
│ Reversibility: [easy/medium/hard]           │
└─────────────────────────────────────────────┘

[Option C if needed — same format]

RECOMMENDATION
[Pick one. Say why in 2-3 sentences. Be direct.]

WHAT WE'RE GIVING UP
[Name the tradeoff explicitly. What's the cost of this choice?
This forces honesty about what you're sacrificing.]

════════════════════════════════════
```

## Phase 4: Anti-Patterns

Decisions stall for predictable reasons. Call them out:

**"Let's do both"** — No. Doing both means you're not deciding. If you genuinely need both, build one first and the other later. Which one first? That's the decision.

**"Let's prototype and see"** — Sometimes valid. Usually a delay tactic. If a 2-hour spike will genuinely resolve uncertainty, do it. If you'll still be unsure after, decide now.

**"It depends"** — On what? Name the specific variable. If you can name it, you can evaluate it. If you can't, you're stalling.

**"What do other companies use?"** — Useful data point, bad decision framework. You're not other companies. What matters is your constraints, your timeline, your team.

**Bike-shedding** — Spending an hour debating a decision that takes 30 minutes to reverse. If the decision is easily reversible, timebox to 10 minutes and pick.

## Phase 5: After the Decision

Once decided:

1. **Save the doc** — Offer to write it as `DECISIONS.md` or `docs/decisions/YYYY-MM-DD-[title].md`
2. **First action** — What's the very first thing to do to execute this decision? Name it.
3. **Kill the other options** — Don't leave doors open. If you picked Clerk, stop evaluating NextAuth. Decision debt compounds.

## Verify

```
[ ] Decision framed as one clear sentence
[ ] 2-4 options — no more
[ ] Each option has: how it works, upside, downside, effort, reversibility
[ ] Criteria are explicit — what matters for THIS decision, not generic
[ ] Recommendation picks one and says why in 2-3 sentences
[ ] "What we're giving up" section names the real tradeoff
[ ] No "it depends" — variables are named and evaluated
[ ] No "let's do both" unless genuinely phased with a clear order
[ ] Decision is saved somewhere the team can find it later
[ ] First action after the decision is named
```
