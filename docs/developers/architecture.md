# Architecture & Tech Stack

## Overview

VibeTalent is a full-stack Next.js application using the **App Router** pattern with server-side rendering, API routes, and Supabase as the backend-as-a-service.

```
┌─────────────────────────────────────────────────┐
│                   Client (Browser)               │
│  Next.js App Router + React 19 + Tailwind CSS   │
└──────────────────────┬──────────────────────────┘
                       │
          ┌────────────┴────────────┐
          │                         │
   Server Components          API Routes
   (SSR + Caching)          (/api/*)
          │                         │
          └────────────┬────────────┘
                       │
          ┌────────────┴────────────┐
          │       Supabase          │
          │  ┌─────────────────┐    │
          │  │   PostgreSQL    │    │
          │  │   + RLS         │    │
          │  ├─────────────────┤    │
          │  │   Auth          │    │
          │  │   (OAuth)       │    │
          │  ├─────────────────┤    │
          │  │   Storage       │    │
          │  │   (Images)      │    │
          │  └─────────────────┘    │
          └─────────────────────────┘
                       │
          ┌────────────┴────────────┐
          │    External Services    │
          │  ┌───────┐ ┌─────────┐ │
          │  │Resend │ │Upstash  │ │
          │  │(Email)│ │(Redis)  │ │
          │  └───────┘ └─────────┘ │
          │  ┌───────┐ ┌─────────┐ │
          │  │GitHub │ │Vercel   │ │
          │  │(API)  │ │(Cron)   │ │
          │  └───────┘ └─────────┘ │
          └─────────────────────────┘
```

## Tech Stack

### Frontend

| Technology | Version | Purpose |
|---|---|---|
| **Next.js** | 16 | Framework (App Router, SSR, API routes) |
| **React** | 19 | UI library with Server Components |
| **TypeScript** | 5 | Type safety across the stack |
| **Tailwind CSS** | v4 | Utility-first styling |
| **Lucide React** | — | Icon library |

### Backend

| Technology | Purpose |
|---|---|
| **Next.js API Routes** | REST API endpoints under `/api/` |
| **Supabase** | PostgreSQL database, Auth, Storage |
| **Upstash Redis** | Rate limiting (60 req/min, 10 reports/hr) |
| **Resend** | Transactional email notifications |

### Infrastructure

| Service | Purpose |
|---|---|
| **Vercel** | Hosting, edge functions, cron jobs |
| **Supabase Cloud** | Managed PostgreSQL + Auth + Storage |
| **GitHub API** | Activity syncing for streak tracking |
| **Google Analytics** | Usage tracking |

## Data Flow Patterns

### Server Components (Read Path)

Pages like `/explore`, `/leaderboard`, and `/profile/[username]` use **Server Components** with cached Supabase queries:

```
Browser Request
  → Next.js Server Component
    → unstable_cache (60s TTL)
      → Supabase PostgreSQL
    ← Cached data
  ← Rendered HTML
```

Caching uses `unstable_cache` with 60-second revalidation to balance freshness with performance.

### API Routes (Write Path)

Mutations go through API routes that validate input, check rate limits, and write to Supabase:

```
Client POST/PATCH/DELETE
  → API Route handler
    → Rate limit check (Upstash Redis)
    → Input validation & sanitization
    → Supabase query (with RLS)
    → Database trigger (auto-update vibe_score)
  ← JSON response
```

### Streak Update Flow

```
POST /api/streak (with auth cookie)
  → Validate session
  → Insert into streak_logs (unique per user/day)
  → PostgreSQL trigger fires
    → update_user_streak() recalculates:
      - current streak
      - longest streak
      - badge level
      - vibe score
  → Return updated user data
```

### Hire Request Flow

```
Client submits hire form (no auth required)
  → POST /api/hire
    → Validate inputs (name, email, message, budget)
    → Block disposable emails (shared validation from src/lib/validation.ts)
    → Rate limit check
    → Insert into hire_requests via createAdminClient() (service role)
    → Send email notification via Resend
  → VibeCoder sees request in /dashboard
  → VibeCoder replies → Chat thread via hire_messages
```

### Admin Client Pattern

Privileged API mutations (public-write paths like hire requests, reviews, and reports) use `createAdminClient()` from `src/lib/supabase/admin.ts`:

```typescript
import { createAdminClient } from "@/lib/supabase/admin";

const sb = createAdminClient(); // Uses SUPABASE_SERVICE_ROLE_KEY
// Throws if key is missing — never silently falls back to anon key
```

This is used for endpoints where unauthenticated users submit data (e.g., `POST /api/hire`). Authenticated user mutations (e.g., updating profile, managing projects) use session-scoped clients via `createServerSupabaseClient()` so RLS ownership checks are enforced. Direct anonymous PostgREST inserts via the anon key are blocked on sensitive tables.

## Key Design Decisions

### Why Supabase?

- **RLS** provides row-level data isolation without custom middleware
- **Auth** handles OAuth complexity (GitHub, Google) out of the box
- **Storage** for project images with public CDN URLs
- **Real-time** capability for future chat features

### Why Server Components?

- Reduced client-side JavaScript bundle
- Direct database access without API round-trips
- Cached queries with automatic revalidation
- SEO-friendly server-rendered pages

### Why Upstash Redis?

- Serverless-compatible (no persistent connections needed)
- Pay-per-request pricing fits serverless model
- Graceful degradation: if Redis is down, requests are allowed through

### Why No Traditional Auth Middleware?

Instead of custom JWT/session middleware on every route, VibeTalent relies on:

1. **Supabase Auth** manages sessions via HTTP-only cookies
2. **Next.js Middleware** refreshes tokens and guards `/dashboard`
3. **RLS Policies** enforce data access at the database level

This three-layer approach means even if an API route forgets to check auth, the database still blocks unauthorized access.
