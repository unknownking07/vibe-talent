---
name: teardown
description: Pick apart an existing product, landing page, or app and analyze what's working, what's not, and what to steal for your own project. Use when the user wants to analyze a competitor, study a product, understand why something converts, review a landing page, or learn from an existing app. Triggers on requests like "teardown", "analyze this product", "review this landing page", "what makes this work", "study this app", "competitor analysis", "what can I steal from this", "break down this site", "why does this convert", or any request to critically analyze an existing product or page.
category: workflow
tags: [teardown, analysis, competitor, landing-page, product-thinking]
author: tushaarmehtaa
---

Pick apart a product, landing page, or app. Find what works, what doesn't, and what's worth stealing for your own project.

## Phase 1: Get the Target

The user provides one of:
- A URL — fetch it and analyze the page
- A product name — search for it, pull the landing page
- A screenshot — analyze what's visible
- A description — work from what they describe

If they provide a URL, read the full page. If the product has multiple pages (pricing, features, about), read those too.

Ask: **"What are you building?"** — The teardown is only useful if you know what to apply it to. If the user hasn't mentioned their own project, ask.

## Phase 2: The 7 Lenses

Analyze through each lens. Not everything applies to every product — skip what's irrelevant.

**1. First Impression (5-second test)**
What do you understand about this product in 5 seconds? Can a stranger tell what it does, who it's for, and why it matters? If not, what's missing?

**2. Positioning**
How does this product position itself? What category does it claim? What's the implicit "us vs. them"? Who are they NOT for? The best products are polarizing — they pick a side.

**3. Copy Quality**
Score the headline, subheadline, CTAs, feature copy, and microcopy. Use the same rules as `/landing-copy`:
- Headline under 10 words?
- Specific benefit over vague promise?
- CTAs pass the "I want to ___" test?
- No "powerful", "seamless", "revolutionary"?
- Does it sound like a human or a marketing team?

**4. Social Proof**
What proof do they show? Numbers, testimonials, logos, case studies, press mentions? Is it specific ("847 teams use this") or vague ("trusted by thousands")? Is it above the fold?

**5. Objection Handling**
What reasons would someone have NOT to buy/use this? Does the page address them? Look for: pricing concerns, trust issues, competitor comparison, "is this for me?" doubts. Unaddressed objections are conversion leaks.

**6. User Experience**
If it's an app: How does onboarding work? What's the time-to-value? What does the empty state look like? How does the first action feel? If it's a landing page: How's the scroll flow? Is there a logical progression from curiosity to action?

**7. Design & Craft**
Visual hierarchy, whitespace, typography, color. Does the design support the message or distract from it? Is it distinctive or template-generic? Does it feel like someone cared?

## Phase 3: The Three Lists

After analysis, distill into three lists:

```
TEARDOWN — [Product Name]
════════════════════════════════════

WHAT'S WORKING:
1. [specific thing] — [why it works]
2. [specific thing] — [why it works]
3. [specific thing] — [why it works]
(3-7 items)

WHAT'S NOT:
1. [specific thing] — [what's wrong and why]
2. [specific thing] — [what's wrong and why]
3. [specific thing] — [what's wrong and why]
(3-7 items)

STEAL THIS:
1. [specific tactic] — [how to apply it to YOUR product]
2. [specific tactic] — [how to apply it to YOUR product]
3. [specific tactic] — [how to apply it to YOUR product]
(3-5 items. Each must reference the user's own project.)

════════════════════════════════════
```

## Phase 4: Go Deeper (Optional)

If the user wants more, offer:

- **Copy rewrite** — take their weakest section and rewrite it using the best tactic from the teardown
- **Side-by-side** — compare two competitors on the same 7 lenses
- **Apply it** — take the "Steal This" list and make the changes in the user's codebase

## Verify

```
[ ] Target product is clearly identified and fully read
[ ] All 7 lenses analyzed (or explicitly skipped with reason)
[ ] "What's Working" has specific observations, not generic praise
[ ] "What's Not" has specific problems, not vague criticism
[ ] "Steal This" items reference the user's own project — not generic advice
[ ] Teardown is opinionated — takes a position, doesn't sit on the fence
[ ] No "they could consider" or "it might be worth exploring" hedging
[ ] Analysis is grounded in what's visible, not assumptions about their metrics
```
