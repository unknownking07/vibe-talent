---
name: add-analytics
description: Wire PostHog analytics, Sentry error tracking, and a health endpoint into any web project. Reads your stack, installs the right packages, and instruments your app so you stop flying blind in production.
category: devops
tags: [analytics, posthog, sentry, monitoring, error-tracking, observability, health-check]
author: tushaarmehtaa
---

Wire observability into any web project. This skill adds event tracking, error monitoring, and a status endpoint — the three things every indie builder says they'll add later but never does.

## Phase 1: Detect the Stack

Read the project and figure out what to install.

### 1.1 Framework
- `next.config.*` → Next.js (check App Router vs Pages Router)
- `vite.config.*` → Vite / React SPA
- `astro.config.*` → Astro
- `nuxt.config.*` → Nuxt
- Python backend (`main.py`, `app.py`, `manage.py`) → FastAPI / Django / Flask

### 1.2 Existing Analytics
Check if any analytics/monitoring is already installed:
- `posthog-js` or `posthog-node` → PostHog already present
- `@sentry/nextjs` or `@sentry/react` or `sentry-sdk` → Sentry already present
- `@vercel/analytics` → Vercel Analytics present
- `@google-analytics` or `gtag` → GA present

If already installed, audit the setup instead of installing fresh. Check for gaps (missing error boundaries, no server-side tracking, no health endpoint).

### 1.3 Ask the User
```
Detected: [framework]
Existing analytics: [what's already there, or "none"]

I'll set up:
1. PostHog — event tracking, user identification, feature flags
2. Sentry — error tracking with source maps
3. Health endpoint — /api/status for uptime monitoring

Need your project keys:
- PostHog API key (get from app.posthog.com → Project Settings)
- Sentry DSN (get from sentry.io → Project Settings → Client Keys)

Or I can set up the code and you add the keys later.
```

## Phase 2: PostHog Analytics

### 2.1 Install

**Next.js:**
```bash
npm install posthog-js posthog-node
```

**React SPA (Vite):**
```bash
npm install posthog-js
```

**Python:**
```bash
pip install posthog
```

### 2.2 Client-Side Provider

**Next.js App Router** — create `app/providers.tsx`:

```typescript
'use client';

import posthog from 'posthog-js';
import { PostHogProvider as PHProvider, usePostHog } from 'posthog-js/react';
import { useEffect } from 'react';

if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
    person_profiles: 'identified_only',
    capture_pageview: false, // We handle this manually for SPA navigation
    capture_pageleave: true,
    loaded: (posthog) => {
      if (process.env.NODE_ENV === 'development') {
        // Disable in dev unless you want to test
        // posthog.opt_out_capturing();
      }
    },
  });
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  return <PHProvider client={posthog}>{children}</PHProvider>;
}
```

Wrap the app in `layout.tsx`:
```typescript
import { PostHogProvider } from './providers';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  );
}
```

**React SPA (Vite)** — create `lib/analytics.ts`:

```typescript
import posthog from 'posthog-js';

let initialized = false;

export function initAnalytics() {
  if (initialized || typeof window === 'undefined') return;

  const key = import.meta.env.VITE_POSTHOG_KEY;
  if (!key) return;

  posthog.init(key, {
    api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
    person_profiles: 'identified_only',
    capture_pageview: true,
  });

  initialized = true;
}

export { posthog };
```

Call `initAnalytics()` in your app entry point.

### 2.3 Page View Tracking (Next.js SPA)

PostHog doesn't auto-track SPA navigation. Add a component that fires on route changes:

```typescript
// components/PostHogPageView.tsx
'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { usePostHog } from 'posthog-js/react';
import { useEffect, Suspense } from 'react';

function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const posthog = usePostHog();

  useEffect(() => {
    if (pathname && posthog) {
      let url = window.origin + pathname;
      const search = searchParams.toString();
      if (search) url += '?' + search;
      posthog.capture('$pageview', { $current_url: url });
    }
  }, [pathname, searchParams, posthog]);

  return null;
}

export function PostHogPageView() {
  return (
    <Suspense fallback={null}>
      <PageViewTracker />
    </Suspense>
  );
}
```

Add to layout:
```typescript
<PostHogProvider>
  <PostHogPageView />
  {children}
</PostHogProvider>
```

### 2.4 User Identification

When a user logs in, identify them in PostHog so events are linked to a person:

```typescript
import posthog from 'posthog-js';

// Call this after successful auth sync
function identifyUser(user: { id: string; email?: string; name?: string }) {
  posthog.identify(user.id, {
    email: user.email,
    name: user.name,
  });
}

// Call this on logout
function resetUser() {
  posthog.reset();
}
```

Wire this into your auth hook or auth sync callback.

### 2.5 Custom Event Tracking

Create a thin wrapper for type safety and consistency:

```typescript
// lib/track.ts
import posthog from 'posthog-js';

type TrackEvent =
  | { event: 'signed_up'; properties?: { method: string } }
  | { event: 'created_project'; properties: { projectId: string } }
  | { event: 'upgraded_plan'; properties: { plan: string; price: number } }
  | { event: 'used_feature'; properties: { feature: string } };

export function track({ event, properties }: TrackEvent) {
  posthog.capture(event, properties);
}
```

Usage:
```typescript
track({ event: 'created_project', properties: { projectId: '123' } });
```

The union type ensures you can't track events with wrong properties. Add your events to the union as your product grows.

### 2.6 Server-Side Tracking (Next.js)

For events that happen on the server (API routes, webhooks):

```typescript
// lib/posthog-server.ts
import { PostHog } from 'posthog-node';

let client: PostHog | null = null;

export function getPostHogServer() {
  if (!client && process.env.POSTHOG_API_KEY) {
    client = new PostHog(process.env.POSTHOG_API_KEY, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return client;
}
```

Usage in API routes:
```typescript
const posthog = getPostHogServer();
posthog?.capture({
  distinctId: userId,
  event: 'api_call',
  properties: { endpoint: '/api/generate', status: 200 },
});
```

## Phase 3: Sentry Error Tracking

### 3.1 Install

**Next.js:**
```bash
npx @sentry/wizard@latest -i nextjs
```

This auto-creates `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, and updates `next.config.ts`. Review the generated files.

**React SPA (Vite):**
```bash
npm install @sentry/react
```

**Python (FastAPI):**
```bash
pip install sentry-sdk[fastapi]
```

### 3.2 Configuration

**Next.js** — the wizard generates most of this. Review and adjust:

`sentry.client.config.ts`:
```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
  debug: false,
  enabled: process.env.NODE_ENV === 'production',
});
```

Key settings:
- `tracesSampleRate: 0.1` — sample 10% of transactions in prod (controls cost)
- `replaysOnErrorSampleRate: 1.0` — always capture session replay when errors happen
- `enabled: false` in development — don't pollute Sentry with dev errors

**React SPA:**
```typescript
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
  enabled: import.meta.env.PROD,
});
```

**Python (FastAPI):**
```python
import sentry_sdk

sentry_sdk.init(
    dsn=os.getenv("SENTRY_DSN"),
    traces_sample_rate=0.1,
    profiles_sample_rate=0.1,
    environment=os.getenv("ENVIRONMENT", "development"),
    enabled=os.getenv("ENVIRONMENT") == "production",
)
```

### 3.3 Error Boundary (React)

Create a global error boundary that catches rendering errors:

**Next.js App Router** — `app/global-error.tsx`:
```typescript
'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h1>something went wrong</h1>
          <p style={{ color: '#666', marginTop: '0.5rem' }}>
            the error has been reported automatically.
          </p>
          <button
            onClick={reset}
            style={{ marginTop: '1rem', padding: '0.5rem 1rem', cursor: 'pointer' }}
          >
            try again
          </button>
        </div>
      </body>
    </html>
  );
}
```

**Also add `app/error.tsx`** for non-fatal page errors:
```typescript
'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div style={{ padding: '2rem' }}>
      <h2>something went wrong</h2>
      <button onClick={reset}>try again</button>
    </div>
  );
}
```

### 3.4 Structured Error Logging

Create a helper for logging errors with context:

```typescript
// lib/logger.ts
import * as Sentry from '@sentry/nextjs';

interface ErrorContext {
  userId?: string;
  action?: string;
  metadata?: Record<string, any>;
}

export function logError(error: unknown, context?: ErrorContext) {
  const err = error instanceof Error ? error : new Error(String(error));

  if (context) {
    Sentry.withScope((scope) => {
      if (context.userId) scope.setUser({ id: context.userId });
      if (context.action) scope.setTag('action', context.action);
      if (context.metadata) scope.setExtras(context.metadata);
      Sentry.captureException(err);
    });
  } else {
    Sentry.captureException(err);
  }

  // Also log to console in development
  if (process.env.NODE_ENV !== 'production') {
    console.error('[Error]', err.message, context);
  }
}
```

Usage:
```typescript
try {
  await generateContent(prompt);
} catch (error) {
  logError(error, {
    userId: user.id,
    action: 'generate_content',
    metadata: { promptLength: prompt.length },
  });
}
```

## Phase 4: Health Endpoint

A single endpoint that tells you if the app is alive. Use it for uptime monitoring (Vercel cron, UptimeRobot, Better Uptime).

### Next.js — `app/api/status/route.ts`:

```typescript
import { NextResponse } from 'next/server';

const startTime = Date.now();

export async function GET() {
  const uptime = Math.floor((Date.now() - startTime) / 1000);

  // Basic health check
  const health: Record<string, any> = {
    status: 'ok',
    uptime: `${uptime}s`,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'unknown',
    version: process.env.NEXT_PUBLIC_APP_VERSION || 'dev',
  };

  // Database check (if applicable)
  try {
    // Supabase
    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      const { error } = await supabase.from('users').select('id').limit(1);
      health.database = error ? 'error' : 'ok';
    }

    // Prisma
    // const count = await prisma.user.count();
    // health.database = 'ok';
  } catch {
    health.database = 'error';
  }

  const isHealthy = health.database !== 'error';

  return NextResponse.json(health, {
    status: isHealthy ? 200 : 503,
  });
}
```

### Python (FastAPI):

```python
from datetime import datetime
import time

START_TIME = time.time()

@app.get("/api/status")
async def health_check():
    uptime = int(time.time() - START_TIME)
    return {
        "status": "ok",
        "uptime": f"{uptime}s",
        "timestamp": datetime.utcnow().isoformat(),
        "environment": os.getenv("ENVIRONMENT", "development"),
    }
```

### What to monitor

Set up a cron or external service to hit `/api/status` every 5 minutes. Alert if:
- Response status is not 200
- Response time exceeds 5 seconds
- Database field is "error"

**Free options:** UptimeRobot (free tier), Better Uptime, or Vercel's built-in cron.

## Phase 5: Environment Variables

Add to `.env.local` (or `.env`):

```
# PostHog
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
POSTHOG_API_KEY=phc_...  # Same key, used server-side

# Sentry
NEXT_PUBLIC_SENTRY_DSN=https://xxx@o123.ingest.sentry.io/456
SENTRY_AUTH_TOKEN=sntrys_...  # For source map uploads
SENTRY_ORG=your-org
SENTRY_PROJECT=your-project
```

Verify none of these are committed to git. Check `.gitignore` includes `.env*`.

## Phase 6: Verify

After wiring everything, test each system:

```
PostHog:
[ ] Open the app → check PostHog dashboard for a pageview event
[ ] Navigate between pages → each page triggers a pageview
[ ] Log in → user appears in PostHog with email/name (identified)
[ ] Track a custom event → appears in PostHog events
[ ] Log out → posthog.reset() called, new anonymous session

Sentry:
[ ] Add a temporary `throw new Error('sentry test')` to a page
[ ] Load the page → error appears in Sentry dashboard
[ ] Check that source maps resolve (you see your actual code, not minified)
[ ] Remove the test error
[ ] Error boundary renders fallback UI (not a white screen)

Health Endpoint:
[ ] GET /api/status returns 200 with uptime and database status
[ ] If database is down, returns 503
[ ] Set up monitoring service to ping it every 5 minutes
```

Tell the user which systems are live and working.

## Important Notes

- **PostHog is free** up to 1M events/month. More than enough for indie projects.
- **Sentry is free** up to 5K errors/month. If you're hitting that, you have bigger problems.
- **Don't track PII** in PostHog events (no passwords, no credit card numbers). User IDs and emails are fine.
- **Sample rates matter.** 10% tracing in prod keeps costs near zero. Increase only if debugging specific issues.
- **Source maps** are critical for Sentry. Without them, error stack traces show minified code. The Sentry wizard handles this for Next.js. For other frameworks, upload maps during build.
