# Ship Email — Reference Guide

## Email Copy by Segment

### Power Users (top 20% by usage)

**Goal:** Convert to paid or higher tier.

```
Subject: you're one of our most active users

Hey [Name],

You've used [Product] more than 80% of our users this month.

We're working on [upcoming feature] — would love your take on it.
And if you haven't already, [paid tier] gets you [key benefit].

— [Your Name]
```

### Active Users (regular usage, not top tier)

**Goal:** Deepen engagement, educate on underused features.

```
Subject: one thing most people miss in [Product]

Hey [Name],

Most users never discover [underused feature]. It [specific benefit].

[One sentence on how to find/use it].

Let me know if you try it.

— [Your Name]
```

### Dormant Users (no activity in 7-30 days)

**Goal:** Re-engagement.

```
Subject: still there?

Hey [Name],

Haven't seen you in a while. [Product] has [one improvement since they last used it].

Takes 30 seconds to try: [CTA URL]

— [Your Name]
```

### Churned Users (30+ days inactive)

**Goal:** Win-back or learn why they left.

```
Subject: honest question

Hey [Name],

You haven't used [Product] in a while. Genuinely curious — was it missing something, or just not the right time?

One reply is enough. Happy to hear it.

— [Your Name]
```

---

## Subject Line Formulas

| Formula | Example |
|---------|---------|
| "[Number] [thing] about [topic]" | "one thing most people miss in [Product]" |
| "honest [word]" | "honest question" |
| "you [did something]" | "you're one of our most active users" |
| "[thing] just [changed/happened]" | "something just changed for power users" |
| "still [verb]?" | "still there?" |

**Never use:**
- "Following up on my last email"
- "Quick question"
- "Just checking in"
- "Hope this finds you well"
- ALL CAPS in subject lines
- Exclamation marks in subject lines

---

## Spam Trigger Words to Avoid

In subject lines and body copy:
- Free, free offer, free trial (in subject lines)
- Guaranteed, guarantee
- Act now, limited time (when it isn't)
- Click here
- Earn money, make money
- No obligation
- Risk-free
- Special promotion

---

## Rate Limiting Strategy

| Resend Tier | Daily Limit | Strategy |
|------------|-------------|---------|
| Free | 100 emails/day | Segment campaigns, send in batches |
| Pro ($20/mo) | 50,000/day | Fine for most indie builders |
| Business | 100,000+/day | Only needed at scale |

For campaigns larger than your daily limit:
```typescript
// Send in batches with delay
async function sendCampaignBatch(users: User[], template: string) {
  const BATCH_SIZE = 50;
  const DELAY_MS = 1000;

  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    const batch = users.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(user => sendEmail({ to: user.email, ... })));
    if (i + BATCH_SIZE < users.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
  }
}
```

---

## Resend Webhooks (for delivery tracking)

Resend fires events you can log:
- `email.sent` — left Resend servers
- `email.delivered` — confirmed delivered
- `email.opened` — recipient opened (if tracking enabled)
- `email.clicked` — link clicked
- `email.bounced` — hard bounce (remove from list)
- `email.complained` — spam complaint (remove immediately)

```typescript
// app/api/webhooks/resend/route.ts
export async function POST(req: Request) {
  const event = await req.json();

  if (event.type === 'email.bounced' || event.type === 'email.complained') {
    await db.user.update({
      where: { email: event.data.to },
      data: { emailUnsubscribed: true }
    });
  }
}
```

---

## Unsubscribe Implementation

Every campaign email must have an unsubscribe link:

```typescript
// Generate unsubscribe token
import { createHmac } from 'crypto';

function generateUnsubToken(email: string): string {
  return createHmac('sha256', process.env.UNSUB_SECRET!)
    .update(email)
    .digest('hex');
}

// In template
const unsubUrl = `https://yourdomain.com/unsubscribe?email=${encodeURIComponent(email)}&token=${generateUnsubToken(email)}`;

// Footer of every campaign email
`<p style="font-size: 12px; color: #999;">
  <a href="${unsubUrl}">Unsubscribe</a>
</p>`
```

```typescript
// app/api/unsubscribe/route.ts
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email');
  const token = searchParams.get('token');

  if (generateUnsubToken(email!) !== token) {
    return new Response('Invalid link', { status: 400 });
  }

  await db.user.update({ where: { email: email! }, data: { emailUnsubscribed: true } });
  return new Response('Unsubscribed successfully');
}
```
