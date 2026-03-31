---
name: dodo-webhook
description: Wire Dodo Payments webhooks end-to-end — signature verification using the Standard Webhooks spec, idempotent processing, subscription lifecycle handling, and database sync. Use when the user needs to handle Dodo payment events, set up webhook endpoints, process payments, or sync billing data with their database. Triggers on requests like "Dodo webhook", "Dodo Payments webhook", "payment webhook", "handle Dodo events", "payment lifecycle", "billing sync", or any mention of processing Dodo Payments events.
category: payments
tags: [dodo-payments, webhooks, payments, billing, backend]
author: tushaarmehtaa
---

Wire Dodo Payments webhooks end-to-end — signature verification, event routing, idempotency, and database sync. Three specific mistakes will silently break this. All three are covered.

## Why This Exists

Dodo uses the Standard Webhooks spec. This is different from Stripe. The mistakes that will burn you:

1. Using the raw `DODO_WEBHOOK_SECRET` string for verification — it won't work. The secret comes in `whsec_xxxxx` format. You must strip the `whsec_` prefix and base64-decode the rest before using it. This fails silently in log-only mode, so you'll think verification works until you test strictly.
2. Letting any middleware parse the body as JSON before you verify. Signature verification happens over the raw body bytes. Once it's parsed and re-serialized, the bytes change and verification fails.
3. Returning non-200 on processing errors. Dodo retries any non-200. If your handler throws and returns 500, you'll process the same payment event over and over.

## Phase 1: Detect the Stack

Check the codebase:
- **Framework**: Next.js App Router / Pages Router / FastAPI / Express?
- **Database ORM**: Prisma / Drizzle / Supabase / Mongoose / raw SQL?
- **User model**: What field stores plan/credits? How is `userId` stored?
- **Existing webhook routes**: Any `/api/webhooks/` directory already?

## Phase 2: Install Dependencies

```bash
# Node / Next.js
npm install standardwebhooks

# Python / FastAPI
pip install standardwebhooks
```

Add to `.env.example`:
```
DODO_API_KEY=
DODO_WEBHOOK_SECRET=        # whsec_... format from Dodo dashboard
DODO_PRODUCT_ID=            # Product ID for the thing users are buying
APP_URL=                    # Frontend URL for checkout redirect
```

## Phase 3: Webhook Endpoint

### Next.js App Router

```typescript
// app/api/webhooks/dodo/route.ts
import { Webhook } from 'standardwebhooks';

export async function POST(req: Request) {
  // CRITICAL: raw body — never req.json() here
  const body = await req.text();

  const webhookId = req.headers.get('webhook-id');
  const webhookTimestamp = req.headers.get('webhook-timestamp');
  const webhookSignature = req.headers.get('webhook-signature');

  if (!webhookId || !webhookTimestamp || !webhookSignature) {
    return new Response('Missing webhook headers', { status: 400 });
  }

  // Verify signature
  let event: Record<string, any>;
  try {
    const secret = process.env.DODO_WEBHOOK_SECRET!;
    // Strip whsec_ prefix — this is the step everyone misses
    const base64Secret = secret.startsWith('whsec_') ? secret.slice(6) : secret;
    const wh = new Webhook(base64Secret);

    event = wh.verify(body, {
      'webhook-id': webhookId,
      'webhook-timestamp': webhookTimestamp,
      'webhook-signature': webhookSignature,
    }) as Record<string, any>;
  } catch (err) {
    console.error('Dodo webhook signature verification failed:', err);
    return new Response('Invalid signature', { status: 400 });
  }

  // Idempotency — skip already-processed events
  const alreadyProcessed = await checkEventProcessed(webhookId);
  if (alreadyProcessed) {
    return new Response('Already processed', { status: 200 });
  }

  try {
    await handleEvent(event);
    await markEventProcessed(webhookId);
  } catch (err) {
    // Log but still return 200 — otherwise Dodo retries endlessly
    console.error(`Error processing Dodo event ${event.type}:`, err);
  }

  return new Response('OK', { status: 200 });
}
```

### FastAPI / Python

```python
from fastapi import Request, HTTPException
from standardwebhooks import Webhook
import os

@app.post("/api/webhooks/dodo")
async def dodo_webhook(request: Request):
    body = await request.body()  # raw bytes

    webhook_id = request.headers.get("webhook-id")
    webhook_timestamp = request.headers.get("webhook-timestamp")
    webhook_signature = request.headers.get("webhook-signature")

    if not all([webhook_id, webhook_timestamp, webhook_signature]):
        raise HTTPException(status_code=400, detail="Missing headers")

    raw_secret = os.environ["DODO_WEBHOOK_SECRET"]
    # Strip whsec_ prefix
    base64_secret = raw_secret[6:] if raw_secret.startswith("whsec_") else raw_secret

    try:
        wh = Webhook(base64_secret)
        event = wh.verify(body, {
            "webhook-id": webhook_id,
            "webhook-timestamp": webhook_timestamp,
            "webhook-signature": webhook_signature,
        })
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid signature")

    if await event_already_processed(webhook_id):
        return {"received": True}

    try:
        await handle_event(event)
        await mark_event_processed(webhook_id)
    except Exception as e:
        print(f"Error processing {event.get('type')}: {e}")
        # Still return 200

    return {"received": True}
```

### Next.js Proxy Pattern

If the frontend proxies to a separate backend, the Next.js route must forward the raw body and all three Standard Webhooks headers. Do not let Next.js parse the body:

```typescript
// app/api/webhooks/dodo/route.ts (proxy version)
export async function POST(request: Request) {
  const body = await request.text();

  const headersToForward: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  for (const h of ['webhook-id', 'webhook-timestamp', 'webhook-signature']) {
    const v = request.headers.get(h);
    if (v) headersToForward[h] = v;
  }

  try {
    const response = await fetch(`${process.env.BACKEND_URL}/api/webhooks/dodo`, {
      method: 'POST',
      headers: headersToForward,
      body,
    });
    return new Response(await response.text(), { status: response.status });
  } catch {
    // Always return 200 to Dodo even if backend is unreachable
    return new Response(JSON.stringify({ received: true }), { status: 200 });
  }
}
```

## Phase 4: Event Router and Handlers

```typescript
async function handleEvent(event: Record<string, any>) {
  switch (event.type) {
    case 'payment.succeeded':
      return handlePaymentSucceeded(event.data);
    case 'payment.failed':
      return handlePaymentFailed(event.data);
    case 'subscription.active':
      return handleSubscriptionActivated(event.data);
    case 'subscription.cancelled':
      return handleSubscriptionCancelled(event.data);
    case 'subscription.on_hold':
      return handleSubscriptionOnHold(event.data);
    default:
      console.log(`Unhandled Dodo event type: ${event.type}`);
  }
}
```

Generate handlers that match the actual user model in the codebase:

```typescript
async function handlePaymentSucceeded(data: Record<string, any>) {
  const userId = data.metadata?.userId;
  if (!userId) {
    console.error('No userId in Dodo payment metadata — cannot update user. Check checkout creation.');
    return;
  }

  const creditsToAdd = parseInt(data.metadata?.credits || '100');

  // Adapt this to match the detected ORM and user schema
  await db.user.update({
    where: { id: userId },
    data: {
      credits: { increment: creditsToAdd },
      dodoCustomerId: data.customer?.id,
    },
  });
}

async function handleSubscriptionCancelled(data: Record<string, any>) {
  const userId = data.metadata?.userId;
  if (!userId) return;

  await db.user.update({
    where: { id: userId },
    data: { plan: 'free' },
  });
}
```

**The userId comes from metadata you attach at checkout creation.** If checkout is created without `metadata: { userId }`, the webhook has no way to find the user. Always verify this is set.

## Phase 5: Idempotency Layer

Dodo retries events on non-200 responses and occasionally delivers duplicates. Process each event exactly once.

```sql
-- Add this table to your database
CREATE TABLE processed_webhooks (
  webhook_id TEXT PRIMARY KEY,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);
```

```typescript
async function checkEventProcessed(webhookId: string): Promise<boolean> {
  const existing = await db.processedWebhook.findUnique({ where: { webhookId } });
  return !!existing;
}

async function markEventProcessed(webhookId: string): Promise<void> {
  await db.processedWebhook.create({ data: { webhookId } });
}
```

For Supabase without an ORM:
```typescript
async function checkEventProcessed(webhookId: string) {
  const { data } = await supabase
    .from('processed_webhooks')
    .select('webhook_id')
    .eq('webhook_id', webhookId)
    .maybeSingle();
  return !!data;
}
```

## Phase 6: Checkout Creation (the other half)

The webhook only works if checkout was created correctly. Check the checkout creation endpoint and ensure `userId` is in metadata:

```typescript
// api/payments/create-checkout/route.ts
const checkout = await dodo.payments.create({
  payment_link: true,
  customer: { email: user.email },
  product_cart: [{ product_id: process.env.DODO_PRODUCT_ID!, quantity: 1 }],
  metadata: {
    userId: user.id,        // REQUIRED — webhook uses this to find the user
    credits: '100',         // how many credits to add on success
  },
  return_url: `${process.env.APP_URL}/checkout/success`,
});

return Response.json({ checkout_url: checkout.payment_link });
```

## Phase 7: Local Testing

Use ngrok to expose your local server, then add the ngrok URL as a webhook endpoint in the Dodo dashboard (test mode):

```bash
ngrok http 3000
# Add https://your-ngrok-id.ngrok.io/api/webhooks/dodo in Dodo test dashboard
```

Trigger test events from the Dodo dashboard to verify the full flow locally before deploying.

## Phase 8: Verify

```
Flow 1: Signature Verification
[ ] whsec_ prefix stripped before use
[ ] Raw body used — not parsed JSON
[ ] Invalid signatures return 400
[ ] Valid signatures proceed to processing

Flow 2: Payment Succeeded
[ ] userId present in event metadata
[ ] User credits updated in database
[ ] dodoCustomerId stored on user
[ ] Event marked as processed in processed_webhooks

Flow 3: Idempotency
[ ] Same event sent twice → processed only once
[ ] No double-credit on duplicate delivery

Flow 4: Error Handling
[ ] Processing error → logged, 200 returned anyway
[ ] Missing userId in metadata → logged, no crash

Flow 5: Subscription Events
[ ] subscription.cancelled → user plan set to free
[ ] subscription.on_hold → user access restricted
```

## Important Notes

- **The `whsec_` prefix strip is not optional.** Using the raw string fails silently — you won't get an error, verification just won't work.
- **Always return 200.** Even on database errors, return 200. Log the error and investigate, but don't let Dodo retry the same payment event.
- **Idempotency is not optional.** Payment providers retry. Process each event exactly once.
- **Keep checkout metadata minimal but complete.** `userId` is non-negotiable. Add `credits` or `planId` if relevant to your model.
