---
name: pricing-page
description: Scaffold a complete pricing system — tier definitions, feature gating, Dodo Payments integration, and a polished frontend component. Use when the user wants to add pricing, create a pricing page, set up payment tiers, integrate Dodo Payments, or implement feature gating. Triggers on requests like "pricing page", "add pricing", "subscription tiers", "Dodo Payments", "payment plans", "feature gating", "freemium model", "monetize my app", "charge users", or any mention of pricing, billing, or subscription management.
category: monetization
tags: [pricing, dodo-payments, feature-gating, subscriptions, monetization]
author: tushaarmehtaa
---

Scaffold a complete pricing system — tier definitions, feature gating logic, Dodo Payments checkout, and a frontend pricing component. Reads the project first, wires into the existing stack.

## Phase 1: Understand the Project

Before writing anything, read the codebase:

### 1.1 Stack Detection
- **Framework**: Next.js / other?
- **Database**: What ORM/client? What does the users table look like?
- **Auth**: How is the current user identified in API routes?
- **Existing payments**: Any Dodo SDK or payment routes already?

### 1.2 Ask the User

```
I'll scaffold pricing for your [framework] app.

Quick decisions:

1. How many tiers? (e.g., Free + Pro, or Free + Pro + Enterprise)
2. What's the pricing model? (flat rate / credits / per-seat / usage-based)
3. Monthly billing, annual, or both?
4. What features are gated behind paid? (or let me suggest based on the codebase)

I'll handle Dodo Payments integration.
```

## Phase 2: Tier Definitions

Create a single source of truth for tiers. Adapt based on the user's answers:

```typescript
// config/pricing.ts

export type Plan = 'free' | 'pro' | 'enterprise';

export const PLANS = {
  free: {
    name: 'Free',
    price: 0,
    description: 'Get started',
    features: ['[Feature 1]', '[Feature 2]'],
    limits: {
      // Fill based on codebase — e.g., creditsPerMonth: 50
    },
    cta: 'Get Started',
    ctaHref: '/signup',
  },
  pro: {
    name: 'Pro',
    priceMonthly: 0, // fill from user
    priceAnnual: 0,  // fill from user
    description: 'For serious users',
    features: ['Everything in Free', '[Pro Feature 1]', '[Pro Feature 2]'],
    limits: {
      // creditsPerMonth: 500, etc.
    },
    cta: 'Upgrade to Pro',
    highlighted: true,
    badge: 'Most Popular',
  },
} as const;
```

For a credits-based app, add credit pack definitions alongside plan definitions.

## Phase 3: Feature Gating

Create a utility that checks access before any gated feature runs. This is the enforcement layer — everything else is display:

```typescript
// lib/feature-gate.ts

type Plan = 'free' | 'pro' | 'enterprise';

// Define which plans can access which features
// Populate based on what actually exists in the codebase
const FEATURE_ACCESS: Record<string, Plan[]> = {
  'api-access': ['pro', 'enterprise'],
  'export-data': ['pro', 'enterprise'],
  'custom-domain': ['enterprise'],
  'priority-support': ['enterprise'],
};

export function canAccess(userPlan: Plan, feature: string): boolean {
  return FEATURE_ACCESS[feature]?.includes(userPlan) ?? false;
}
```

In API routes, check before any expensive work:

```typescript
export async function POST(req: Request) {
  const user = await getAuthUser(req);

  if (!canAccess(user.plan, 'api-access')) {
    return Response.json(
      { error: 'This feature requires Pro.', upgradeUrl: '/pricing' },
      { status: 403 }
    );
  }

  // ... rest of handler
}
```

In UI, show the locked state rather than hiding the feature. Users need to know the feature exists:

```tsx
function ExportButton({ userPlan }: { userPlan: Plan }) {
  if (!canAccess(userPlan, 'export-data')) {
    return (
      <button
        onClick={() => router.push('/pricing')}
        className="opacity-60"
        title="Upgrade to Pro to export"
      >
        🔒 Export — Pro only
      </button>
    );
  }
  return <button onClick={handleExport}>Export</button>;
}
```

## Phase 4: Dodo Payments Integration

### Environment Variables

```
DODO_API_KEY=          # From Dodo dashboard
DODO_WEBHOOK_SECRET=   # whsec_... format — see /dodo-webhook skill
DODO_PRODUCT_ID=       # Product ID for Pro plan
APP_URL=               # Frontend URL for checkout redirect
```

Install: `npm install @dodopayments/sdk`

### Checkout Creation Endpoint

```typescript
// app/api/payments/create-checkout/route.ts
import DodoPayments from '@dodopayments/sdk';

const dodo = new DodoPayments({ bearerToken: process.env.DODO_API_KEY });

export async function POST(req: Request) {
  const user = await getAuthUser(req);
  const { planId } = await req.json();

  const checkout = await dodo.payments.create({
    payment_link: true,
    customer: { email: user.email },
    product_cart: [{ product_id: process.env.DODO_PRODUCT_ID!, quantity: 1 }],
    metadata: {
      userId: user.id,   // REQUIRED — webhook uses this
      planId,            // which plan they're buying
    },
    return_url: `${process.env.APP_URL}/checkout/success?plan=${planId}`,
  });

  return Response.json({ checkout_url: checkout.payment_link });
}
```

**The metadata is how your webhook finds the user.** If `userId` isn't in metadata, the webhook can't update the right account. Use the `/dodo-webhook` skill to wire the webhook handler.

### Customer Portal

Link users to Dodo's hosted billing portal for plan management, cancellation, and invoice history:

```typescript
// app/api/billing/portal/route.ts
export async function GET(req: Request) {
  const user = await getAuthUser(req);

  const portal = await dodo.customerPortal.create({
    customer_id: user.dodoCustomerId,
    return_url: `${process.env.APP_URL}/settings/billing`,
  });

  return Response.json({ portal_url: portal.url });
}
```

Add a "Manage billing" link in user settings that hits this endpoint.

### Checkout Success Page

Create `/checkout/success` — this is the page Dodo redirects to after payment. The webhook may arrive a few seconds after the redirect, so poll for the updated plan:

```typescript
// app/checkout/success/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CheckoutSuccess() {
  const [plan, setPlan] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Poll until plan updates (webhook may lag by a few seconds)
    let attempts = 0;
    const interval = setInterval(async () => {
      const res = await fetch('/api/auth/me');
      const user = await res.json();
      if (user.plan !== 'free' || attempts > 10) {
        setPlan(user.plan);
        clearInterval(interval);
      }
      attempts++;
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!plan) return <p>Confirming your upgrade...</p>;

  return (
    <div>
      <h1>You're on {plan}.</h1>
      <p>Your account has been upgraded.</p>
      <a href="/dashboard">Go to dashboard →</a>
    </div>
  );
}
```

## Phase 5: Pricing UI Component

Generate a responsive pricing component. The design must emphasize one tier — users who see three equal-weight tiers often leave without deciding:

```tsx
// components/pricing-cards.tsx
'use client';

import { PLANS } from '@/config/pricing';

interface PricingCardsProps {
  currentPlan?: string;
  onUpgrade?: (planId: string) => void;
}

export function PricingCards({ currentPlan, onUpgrade }: PricingCardsProps) {
  const handleUpgrade = async (planId: string) => {
    const res = await fetch('/api/payments/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId }),
    });
    const { checkout_url } = await res.json();
    window.location.href = checkout_url;
  };

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {Object.entries(PLANS).map(([planId, plan]) => (
        <div
          key={planId}
          className={`rounded-xl border p-6 ${
            'highlighted' in plan && plan.highlighted
              ? 'border-black shadow-xl'
              : 'border-gray-200'
          }`}
        >
          {'badge' in plan && plan.badge && (
            <span className="text-xs font-bold uppercase tracking-widest text-black">
              {plan.badge}
            </span>
          )}
          <h3 className="mt-2 text-xl font-bold">{plan.name}</h3>
          <p className="mt-1 text-3xl font-bold">
            {'price' in plan ? (plan.price === 0 ? 'Free' : `$${plan.price}/mo`) : `$${plan.priceMonthly}/mo`}
          </p>
          <ul className="mt-4 space-y-2">
            {plan.features.map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
                <span className="text-green-500">✓</span> {f}
              </li>
            ))}
          </ul>
          <div className="mt-6">
            {currentPlan === planId ? (
              <div className="py-2 text-center text-sm text-gray-400">Current plan</div>
            ) : (
              <button
                onClick={() => handleUpgrade(planId)}
                className={`w-full rounded-lg py-2 text-sm font-medium ${
                  'highlighted' in plan && plan.highlighted
                    ? 'bg-black text-white'
                    : 'border border-gray-300 text-gray-700 hover:border-black'
                }`}
              >
                {plan.cta}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
```

## Phase 6: Verify

```
Flow 1: Feature Gating
[ ] Free user hits gated endpoint → 403 with upgradeUrl
[ ] Pro user hits same endpoint → proceeds normally
[ ] Gated UI shows locked state, links to /pricing

Flow 2: Checkout
[ ] "Upgrade" button creates checkout session
[ ] Redirects to Dodo-hosted checkout page
[ ] userId is in checkout metadata
[ ] After payment, redirects to /checkout/success

Flow 3: Webhook (handled by /dodo-webhook skill)
[ ] Webhook verified and processed
[ ] User plan updated in database
[ ] Success page reflects new plan after polling

Flow 4: Billing Portal
[ ] "Manage billing" link accessible in settings
[ ] Opens Dodo customer portal
[ ] Returns to app after portal actions

Flow 5: Edge Cases
[ ] Users without dodoCustomerId don't crash portal link
[ ] Checkout success polling stops after plan updates
[ ] Env vars in .env.example, not hardcoded
```

See [references/guide.md](references/guide.md) for pricing psychology, A/B test ideas, and advanced feature gating patterns.
