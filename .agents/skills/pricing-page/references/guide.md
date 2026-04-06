# Pricing Page — Reference Guide

## Pricing Psychology That Actually Works

### The Decoy Effect
Add a middle tier that makes the top tier look reasonable. If Pro is $49/mo and Enterprise is $199/mo, users anchor to Pro. If you only had Free and $199/mo, $199 feels expensive.

### Annual Discount Psychology
- Show annual price as monthly equivalent: "$29/mo, billed annually"
- Show the saving explicitly: "Save $96/year"
- Add urgency if truthful: "Most popular choice"

### Feature Gating Principles
- Gate on VALUE, not on effort to build
- Power features should feel natural to lock, not punitive
- "Need more?" is better framing than "Upgrade required"
- Show locked features on free tier with a lock icon — makes upgrading feel like unlocking, not paying

### What to Put Behind the Gate
Good candidates for gating:
- Volume/usage limits (100 actions/mo free, unlimited paid)
- Integrations with other tools
- API access
- Export/download features
- Team/collaboration features
- Priority support
- Custom branding

Bad candidates (makes free tier feel broken):
- Core functionality that defines what the product is
- Basic settings or preferences
- Basic analytics for the user's own data

---

## Dodo Payments — Key Concepts

### Products vs Payment Links

Dodo has two main primitives:
- **Products** — what you're selling (created in dashboard, has a `product_id`)
- **Payment links** — a URL that takes a customer through checkout

For most indie apps: create one product per plan in the dashboard, then create payment links programmatically.

### Metadata Pattern (Critical)

Always pass user context in metadata at checkout creation:

```typescript
const checkout = await dodo.payments.create({
  payment_link: true,
  customer: { email: user.email },
  product_cart: [{ product_id: process.env.DODO_PRO_PRODUCT_ID!, quantity: 1 }],
  metadata: {
    userId: user.id,        // Your internal user ID
    planId: 'pro',          // Which plan they're buying
    source: 'pricing-page', // Where they came from (optional, useful for analytics)
  },
  return_url: `${process.env.APP_URL}/checkout/success?plan=pro`,
});
```

The webhook receives this metadata — it's how you know which user just paid.

### Handling Plan Upgrades

When a user on Free upgrades to Pro:
1. Dodo fires `payment.succeeded` or `subscription.activated`
2. Your webhook updates `users.plan = 'pro'` in DB
3. Feature gates now pass for pro features
4. User doesn't need to re-login

---

## Advanced Feature Gating Patterns

### In API Routes (Server-side)

```typescript
// Throw early, before any expensive work
export async function POST(req: Request) {
  const user = await getUser(req);

  if (!canAccess(user.plan, 'api-access')) {
    return Response.json(
      { error: 'This feature requires Pro.', upgradeUrl: '/pricing' },
      { status: 403 }
    );
  }

  // ... rest of handler
}
```

### In UI (Client-side)

```tsx
// Show locked state rather than hiding the feature
function ExportButton({ userPlan }: { userPlan: string }) {
  const hasAccess = canAccess(userPlan, 'export-data');

  if (!hasAccess) {
    return (
      <button
        onClick={() => router.push('/pricing')}
        className="opacity-60 cursor-not-allowed"
      >
        🔒 Export Data — Pro only
      </button>
    );
  }

  return <button onClick={handleExport}>Export Data</button>;
}
```

### Usage-Based Limits (Credits Model)

```typescript
// Check before action, deduct after success
async function generateContent(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId } });

  if (user.credits < GENERATION_COST) {
    throw new Error('Insufficient credits');
  }

  const result = await runGeneration();

  await db.user.update({
    where: { id: userId },
    data: { credits: { decrement: GENERATION_COST } }
  });

  return result;
}
```

---

## A/B Test Ideas for Pricing Pages

| Test | Variant A | Variant B |
|------|-----------|-----------|
| CTA copy | "Upgrade to Pro" | "Start Free Trial" |
| Price display | "$29/mo" | "$0.96/day" |
| Annual default | Monthly tab selected | Annual tab selected |
| Feature list | Checkmarks | Detailed descriptions |
| Social proof position | Above pricing | Below pricing |

Run each test for at least 2 weeks and 100+ unique visitors before concluding.

---

## Checkout Success Page

Always redirect to a success page that:
1. Confirms what they bought
2. Shows next steps (not just "thanks!")
3. Links directly to the feature they unlocked

```tsx
// app/checkout/success/page.tsx
export default function CheckoutSuccess({ searchParams }) {
  const plan = searchParams.plan;

  return (
    <div>
      <h1>You're on {plan}.</h1>
      <p>Your account has been upgraded. Here's what you can do now:</p>
      <ul>
        <li>[First pro feature] — <a href="/dashboard/feature">Try it now</a></li>
        <li>[Second pro feature] — <a href="/dashboard/feature2">Try it now</a></li>
      </ul>
    </div>
  );
}
```
