---
name: cold-outreach-sequence
description: Generate complete multi-touch cold outreach sequences — not just one email, but a full 3-5 email sequence with timing, escalation logic, and a different angle per touch. Use when the user needs a sales sequence, drip campaign, follow-up series, or any cold outreach with more than one touchpoint. Triggers on requests like "outreach sequence", "email sequence", "follow-up series", "drip campaign", "sales cadence", "multi-touch outreach", or when someone needs more than a single cold email.
category: workflow
tags: [cold-email, outreach, sequence, sales, follow-up]
author: tushaarmehtaa
---

Generate complete multi-touch cold outreach sequences. Not one email — a full campaign where each touch has a different angle, a specific send day, and a clear job to do. Use `/cold-email` for single emails. Use this when one email isn't enough.

## Before Writing Anything

Gather this information — ask for anything missing:

1. **Target** — Role, company type, industry. The more specific, the better the hook.
2. **Offer** — What you're proposing. One sentence.
3. **Credibility** — Social proof. Numbers, notable clients, results. Be specific.
4. **Goal** — Meeting, demo, partnership, intro, advice?
5. **Unique asset** — Demo link, one-pager, case study, free tool? (goes in Email 3)
6. **Sequence length** — 3 touches (light, 7 days) or 5 touches (standard, 12 days)?

If the user says "make it for [target] offering [thing]", extract the rest from context before asking.

## The Two Sequence Structures

### 5-Touch Standard (12 days)

| Touch | Day | Job | Max Length |
|-------|-----|-----|-----------|
| Email 1 | 1 | Problem + Credibility + Ask | 4 sentences |
| Email 2 | 3 | Bump — low pressure | 2 sentences |
| Email 3 | 5 | Give value, ask nothing | 3 sentences |
| Email 4 | 8 | Social proof — name-drop a real result | 3 sentences |
| Email 5 | 12 | Breakup — clean exit | 2 sentences |

### 3-Touch Light (7 days)

| Touch | Day | Job | Max Length |
|-------|-----|-----|-----------|
| Email 1 | 1 | Problem + Credibility + Ask | 4 sentences |
| Email 2 | 3 | Value-add with asset | 3 sentences |
| Email 3 | 7 | Breakup | 2 sentences |

## The Rules That Don't Move

**Subject lines:**
- Email 1: Short, specific. References something real about them.
- Emails 2-5: Always "Re: [original subject]" — stay in the same thread. Do not break the thread.
- Never use: "Following up", "Checking in", "Touching base", "Just wanted to"

**Length:**
- No email exceeds 60 words in the body
- Emails 2 and 5 should be under 30 words
- If you can remove a word, remove it

**Tone escalation:**

| Touch | Tone |
|-------|------|
| 1 | Confident, direct, problem-aware |
| 2 | Casual, brief, zero pressure |
| 3 | Generous — give something, ask nothing |
| 4 | Social proof — "others are doing this" |
| 5 | Clean exit — door stays open |

**What each touch must NOT do:**
- Email 1: Must not be generic. If you removed the recipient's name, it should fall apart.
- Email 2: Must not re-pitch. Just nudge.
- Email 3: Must not ask for a call, meeting, or response. Only give.
- Email 4: Must not fabricate social proof. Real clients or skip this touch entirely.
- Email 5: Must not guilt-trip. Clean, warm, final.

## The Templates

### Email 1

```
Subject: [specific observation — recent post, job change, company news, product launch]

Hey [Name],

[One sentence: something specific you noticed about them. This sentence must be about them, not you.]

[One sentence: what you do + your strongest proof point.]

[One sentence: specific ask with a time — "15 minutes this week?"]

[Your name]
```

### Email 2

```
Subject: Re: [original subject]

Hey [Name],

Bumping this in case it got buried.

[Your name]
```

### Email 3

```
Subject: Re: [original subject]

Hey [Name],

[One sentence: share something genuinely useful — demo, relevant case study, insight about their industry, or a tool they'd care about.]

No pressure on a call — thought this might be relevant.

[Your name]
```

### Email 4

```
Subject: Re: [original subject]

Hey [Name],

[One sentence: name a real client or result — be specific.] [One sentence: why that's relevant to their situation.]

Happy to show you how — [specific time ask].

[Your name]
```

### Email 5

```
Subject: Re: [original subject]

Hey [Name],

Last note on this. If the timing's off, completely understand — happy to revisit whenever it makes sense.

[Your name]
```

## Research First

Before drafting Email 1, find a hook. A generic opener makes the whole sequence waste of time. Spend 3 minutes looking at:

- Their LinkedIn: recent post, new role, company milestone
- Their Twitter/X: recent tweet about a problem your offer solves
- Their company: recent funding, launch, press mention
- Job postings: what they're hiring tells you what they're building

The hook in Email 1 must be recent (last 30-60 days) and specific. "I love your work" is not a hook.

## Workflow

1. Gather target, offer, credibility, goal, asset, sequence length
2. Research one specific hook for Email 1
3. Draft all emails in sequence order
4. Check: is every email under 60 words?
5. Check: does Email 1 only work if you know who the recipient is?
6. Check: does each touch have a distinct job (no "following up" repeats)?
7. Output complete sequence with send days labeled

## Verify

```
[ ] Every email under 60 words
[ ] Email 1 has a specific, researched hook — not generic
[ ] Emails 2-5 thread on same subject line with "Re:"
[ ] Each touch has a different angle — no repeated pitch
[ ] Email 3 gives value with no ask
[ ] Email 4 uses real social proof — or touch is skipped
[ ] Email 5 is clean — no guilt, door stays open
[ ] Send days use business days (no weekends)
[ ] Asset (if exists) is in Email 3, not Email 1
```

See [references/guide.md](references/guide.md) for full sequence examples across industries and subject line variations.
