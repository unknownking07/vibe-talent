---
name: segment-users
description: Read your database schema, generate behavioral user segments with exact queries, and recommend targeted actions per segment. Use when the user wants to understand their user base, find power users, identify churn risk, build email cohorts, or understand usage patterns. Triggers on requests like "segment users", "who are my power users", "find churned users", "user cohorts", "churn analysis", "inactive users", "behavioral segmentation", "who's about to leave", or any mention of grouping users by activity, usage, or lifecycle.
category: analytics
tags: [segmentation, users, cohorts, churn, analytics]
author: tushaarmehtaa
---

Read your database schema, generate queries for every behavioral segment, and give you the exact action to take with each group. No analytics platform required.

## Phase 1: Read the Schema

Check the codebase for the user model. The signals you need:

- **Usage metric** — What counts as activity? Credits consumed, API calls, generations, logins, content created. Find the field.
- **Timestamps** — `created_at`, `last_active_at`, `last_login_at`. Any date fields on the user.
- **Plan / billing** — Free vs paid, plan name, subscription status.
- **ORM** — Prisma, Drizzle, Mongoose, raw SQL? Match your output to what's already in the codebase.

If any of the three signals are missing (usage, timestamps, plan), tell the user before generating queries. Don't fabricate fields that don't exist in the schema.

## Phase 2: Define the Segments

Use whatever signals are available. Don't force a segment if the data isn't there.

### Usage-Based (requires usage metric)

**Power Users** — top 10% by usage. These people love the product. Treat them differently than everyone else.

**Active** — used in the last 7 days, above median usage.

**Casual** — used in the last 30 days, below median usage.

**Dormant** — no usage in 7–30 days. The clock is ticking.

**Churned** — no usage in 30+ days. Harder to recover, not impossible.

### Lifecycle (requires `created_at`)

**New** — signed up < 7 days ago. Haven't formed a habit yet.

**Onboarding** — 7–14 days, hasn't hit the "aha moment" (define this as hitting a specific usage threshold based on the product).

**Established** — 14–60 days, regular usage pattern.

**Veteran** — 60+ days, consistent activity. The most valuable free-tier users.

### Revenue (requires plan data)

**Free Tier** — never paid.

**Paying** — active subscription or purchased credits.

**At Risk** — paying but usage declining in the last 14 days. The most urgent segment.

**Churned Paid** — was paying, subscription ended. Revenue already lost.

## Phase 3: Generate the Queries

For each applicable segment, generate both SQL and ORM. Adapt to the actual schema — no placeholder column names.

```sql
-- Power Users: top 10% by credits consumed
SELECT *, (initial_credits - credits) AS credits_used
FROM users
ORDER BY credits_used DESC
LIMIT (SELECT COUNT(*) / 10 FROM users);

-- Dormant: was active, silent for 7-30 days
SELECT * FROM users
WHERE last_active_at < NOW() - INTERVAL '7 days'
  AND last_active_at > NOW() - INTERVAL '30 days';

-- At Risk: paying user, usage dropped below half their average
SELECT * FROM users
WHERE plan != 'free'
  AND (initial_credits - credits) < (
    SELECT AVG(initial_credits - credits) * 0.5
    FROM users WHERE plan != 'free'
  );
```

```typescript
// Prisma: dormant users
const dormant = await prisma.user.findMany({
  where: {
    lastActiveAt: {
      lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      gt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    },
  },
});
```

Always include a count query so the user can see the full distribution immediately:

```sql
SELECT 'power_users' AS segment, COUNT(*) AS count FROM users WHERE ...
UNION ALL
SELECT 'active'      AS segment, COUNT(*) AS count FROM users WHERE ...
UNION ALL
SELECT 'dormant'     AS segment, COUNT(*) AS count FROM users WHERE ...
UNION ALL
SELECT 'churned'     AS segment, COUNT(*) AS count FROM users WHERE ...
```

## Phase 4: Recommend Actions

One action per segment. Concrete, not vague.

**Power Users** — upgrade offer or exclusive early access. They're already bought in. A personal email from the founder converts here better than any automated campaign.

**Active** — surface features they haven't used. In-app tooltip or email with one specific feature. Don't pitch; educate.

**Casual** — re-engage with the one thing they got value from. Remind them what worked.

**Dormant** — win-back email. One specific hook: what's changed, what's new. Not "we miss you."

**Churned** — short survey, then an incentive. Find out why before trying to recover them.

**New** — onboarding sequence. Define the "aha moment" threshold and build the first 3 days around reaching it.

**At Risk** — personal outreach before cancellation. A direct message from a human beats automation here.

## Phase 5: Output Format

Print distribution, then queries, then actions.

```
USER SEGMENTS — [project name]
════════════════════════════════════
CURRENT DISTRIBUTION
────────────────────────────────────
Power Users:    [N] users  ([X]%)
Active:         [N] users  ([X]%)
Casual:         [N] users  ([X]%)
Dormant:        [N] users  ([X]%)
Churned:        [N] users  ([X]%)
────────────────────────────────────
Total:          [N] users
════════════════════════════════════
```

If `/ship-email` is installed, offer to generate email templates for each segment after the queries.

## Verify

```
[ ] User model read from codebase — no invented fields
[ ] Usage metric identified and defined
[ ] Only segments with available signals generated
[ ] SQL + ORM queries output for each segment
[ ] Count queries included so distribution is visible
[ ] At Risk segment flagged if any paying users exist
[ ] Action recommendation per segment — specific, not generic
[ ] All column names in queries match the actual schema
```

See [references/guide.md](references/guide.md) for RFM scoring, cohort retention analysis, and churn prediction patterns.
