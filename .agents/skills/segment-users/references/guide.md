# Segment Users — Reference Guide

## RFM Analysis (Advanced Segmentation)

RFM stands for Recency, Frequency, Monetary. Score each user 1-5 on each dimension, combine for a composite score.

```sql
WITH rfm AS (
  SELECT
    id,
    email,
    -- Recency: days since last activity (lower = better, score 5 = most recent)
    CASE
      WHEN last_active_at > NOW() - INTERVAL '7 days' THEN 5
      WHEN last_active_at > NOW() - INTERVAL '14 days' THEN 4
      WHEN last_active_at > NOW() - INTERVAL '30 days' THEN 3
      WHEN last_active_at > NOW() - INTERVAL '60 days' THEN 2
      ELSE 1
    END AS recency_score,
    -- Frequency: number of actions (higher = better)
    CASE
      WHEN action_count > 100 THEN 5
      WHEN action_count > 50 THEN 4
      WHEN action_count > 20 THEN 3
      WHEN action_count > 5 THEN 2
      ELSE 1
    END AS frequency_score,
    -- Monetary: total spend or credits purchased (higher = better)
    CASE
      WHEN total_spend > 100 THEN 5
      WHEN total_spend > 50 THEN 4
      WHEN total_spend > 20 THEN 3
      WHEN total_spend > 0 THEN 2
      ELSE 1
    END AS monetary_score
  FROM users
)
SELECT
  *,
  (recency_score + frequency_score + monetary_score) AS rfm_total,
  CASE
    WHEN recency_score >= 4 AND frequency_score >= 4 THEN 'Champions'
    WHEN recency_score >= 3 AND frequency_score >= 3 THEN 'Loyal'
    WHEN recency_score >= 4 AND frequency_score <= 2 THEN 'New High Potential'
    WHEN recency_score <= 2 AND frequency_score >= 4 THEN 'At Risk'
    WHEN recency_score <= 2 AND frequency_score <= 2 THEN 'Lost'
    ELSE 'Standard'
  END AS rfm_segment
FROM rfm
ORDER BY rfm_total DESC;
```

---

## Cohort Analysis

Track how behavior changes over time for users who signed up in the same week:

```sql
-- Weekly cohort retention
SELECT
  DATE_TRUNC('week', created_at) AS cohort_week,
  COUNT(*) AS cohort_size,
  COUNT(CASE WHEN last_active_at > created_at + INTERVAL '7 days' THEN 1 END) AS retained_week1,
  COUNT(CASE WHEN last_active_at > created_at + INTERVAL '30 days' THEN 1 END) AS retained_month1,
  ROUND(
    COUNT(CASE WHEN last_active_at > created_at + INTERVAL '7 days' THEN 1 END)::numeric
    / COUNT(*) * 100, 1
  ) AS week1_retention_pct
FROM users
GROUP BY cohort_week
ORDER BY cohort_week DESC;
```

---

## Credits-Based App Segments (Bangers Only Pattern)

For apps with a credit system where users start with free credits:

```sql
-- Free users who used all free credits (high intent, didn't pay)
SELECT * FROM users
WHERE credits = 0
  AND total_credits_purchased = 0  -- or track via transactions
  AND created_at > NOW() - INTERVAL '30 days';

-- Free users with credits remaining but haven't used any in 7 days
SELECT * FROM users
WHERE credits > 0
  AND (50 - credits) > 0  -- used some credits (50 = initial free credits)
  AND last_active_at < NOW() - INTERVAL '7 days';

-- Power users: consumed 80%+ of their credits
SELECT * FROM users
WHERE (initial_credits - credits)::float / NULLIF(initial_credits, 0) > 0.8;
```

---

## Action Recommendations — Detailed

### Champions / Power Users
- Send personal thank-you from the founder
- Give early access to new features
- Ask for testimonial or case study
- Offer referral program
- **Do NOT** bombard with upsell — they already love it

### At Risk (Paying, Declining Usage)
```
Subject: noticed you haven't been in [Product] lately

Hey [Name],

Saw your usage dropped recently — wanted to check in directly.

Is there something broken, or something missing that would make [Product] more useful for what you're working on now?

One reply is enough.

— [Your Name]
```

### Free Users Who Hit Credit Limit
```
Subject: you ran out — here's 25 more

Hey [Name],

You used all your free credits. That means [Product] worked well enough that you wanted to keep going.

Here's 25 more on us: [CREDIT_CODE]

If you want unlimited, [paid tier] is $[price]/mo.

— [Your Name]
```

### Churned Paid Users
Goal is learning, not winback (yet):
```
Subject: honest question

Hey [Name],

You cancelled [Product] — no hard feelings at all.

Would genuinely love to know: was it missing something specific, or just not the right time?

One sentence is enough. It'll directly shape what we build next.

— [Your Name]
```

---

## Prisma Segment Queries

```typescript
// Power users — top 10% by credits consumed
const allUsers = await prisma.user.findMany({ select: { id: true, credits: true } });
const sorted = allUsers.sort((a, b) => (50 - b.credits) - (50 - a.credits));
const top10pct = sorted.slice(0, Math.ceil(sorted.length * 0.1)).map(u => u.id);

const powerUsers = await prisma.user.findMany({
  where: { id: { in: top10pct } }
});

// Dormant users
const dormantUsers = await prisma.user.findMany({
  where: {
    lastActiveAt: {
      lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      gt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    }
  }
});

// At-risk paying users
const atRiskUsers = await prisma.user.findMany({
  where: {
    plan: { not: 'free' },
    lastActiveAt: {
      lt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
    }
  }
});
```
