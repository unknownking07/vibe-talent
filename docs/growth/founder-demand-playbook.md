# Founder demand pilot: two-week operating playbook

## Offer and audience

Start with early-stage founders who have a defined web MVP or internal product to build, a decision maker, a budget range, and a near-term timeline. VibeTalent can review the brief and suggest builders with relevant verified projects. Confirm each builder's availability and interest before making an introduction. A GitHub streak is evidence of activity, not proof that someone is taking client work.

Do not claim a guaranteed shortlist, fixed turnaround, project outcome, or platform fee. The current site says there are no platform fees. A builder's paid trial counts as project value, not VibeTalent revenue. Ask founders about willingness to pay for managed matching only after introductions are accepted; record the answer separately.

## Targets and definitions

| Two-week target | Count | Definition |
| --- | ---: | --- |
| Qualified founder briefs | 5 | Decision maker, concrete scope, timing, and budget range confirmed |
| Accepted introductions | 3 | Both founder and builder agree to be introduced |
| Paid trial projects | 1 | Founder pays a builder for a bounded trial scope |

These are pilot targets, not forecasts. Record the actual source and outcome of every brief. Review `/agent/find` visits and GA4's `founder_shortlist_opened`, `founder_brief_submitted`, and `founder_brief_created` to locate UI drop-off. Use `founder_briefs` rows for real submissions; browser analytics can be blocked.

## Daily routine

1. Check new `founder_briefs` rows in Supabase. Review the project description, timing, budget, and consent. Mark qualified or lost with a specific loss reason. Do not copy contact details into public docs or analytics.
2. For each qualified brief, shortlist two or three builders based on relevant verified projects, live examples, and the actual scope. Ask each builder about availability, likely timing, and interest before sharing the founder's details.
3. With both sides' agreement, introduce them and record `introduced`. Follow up to learn whether a paid trial was scoped and started. Record `trial`, `won`, or `lost`, with the reason.
4. Draft five specific founder outreach messages daily from warm introductions, public build requests, or relevant startup communities. Prioritize people who describe an immediate build need. Record the public source and why the offer fits. Send messages only after the owner authorizes that outreach.

## Founder outreach drafts

Personalize one detail from the founder's public post or introduction. Do not imply we know their budget or that a builder is available.

**Warm introduction**

> Hi [name] — [mutual contact] mentioned you're working on [specific product/problem]. VibeTalent has builders with live, verified web projects in React, TypeScript, and Supabase. If you're looking for help shipping a defined part of it, I can review a short brief and suggest a few relevant people after checking their availability. Is there a build you want to start in the next month?

**Reply to a public build request**

> Hi [name] — I saw your note about [specific scope]. We run VibeTalent, where builders show the projects and repositories they've actually shipped. If it's useful, send me the scope, timing, and a rough budget range. I'll see whether we have a relevant builder who's interested and available. No account or fee to request an introduction.

**One follow-up, only when appropriate**

> Hi [name] — following up once on [specific build]. If you've already found someone, no need to reply. If the work is still open, I can review a short brief and check whether a builder with relevant shipped work is available.

## Builder availability draft

> Hi [builder] — a founder is looking for help with [scope, without private contact details]. Their target is [timeline] and budget range is [range]. Your [specific verified project] looks relevant. Are you open to a short paid trial and comfortable being introduced if the scope fits? Please share your availability and any constraints.

Only send the founder's name, email, or full brief after the founder has consented to contact and the builder has agreed to consider an introduction.

## What to learn from every loss

- **No reply to outreach:** Is the target actually hiring now, and did the message name their specific need?
- **Brief started but not submitted:** Use GA4 events to check form drop-off, then inspect validation and copy.
- **Brief qualified but no builder:** Which skill, budget, or availability was missing?
- **Intro accepted but no trial:** Ask whether trust, scope, price, response time, or another option won.
- **Trial completed but no VibeTalent revenue:** Ask whether the founder would pay for managed matching; do not count builder earnings as platform revenue.
