# VibeTalent

A marketplace for vibe coders who actually ship. Build your reputation through coding streaks, shipped projects, GitHub activity, and peer endorsements.

**Live:** [vibetalent.work](https://www.vibetalent.work)

## Tech Stack

- **Next.js 16** (App Router, Server Components, ISR)
- **TypeScript**
- **Tailwind CSS v4** (CSS variables for dark mode)
- **Supabase** (Auth, Database, RLS)
- **Upstash Redis** (Rate limiting)
- **Resend** (Transactional emails)
- **Lucide React** (Icons)

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run the schema in `supabase/schema.sql` via **SQL Editor**
3. Run all migrations in `supabase/migrations/` in date order
4. Copy your project URL, anon key, and service role key from **Settings > API**

### 3. Configure environment variables

```bash
cp .env.local.example .env.local
```

See `.env.local.example` for all required variables (Supabase, Upstash Redis, Resend, etc.).

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── badge/[username]/       # Dynamic badge SVG
│   │   ├── builders/[username]/    # Builder outcomes
│   │   ├── cron/                   # Scheduled jobs
│   │   │   ├── check-live-urls/    # Weekly live URL checker
│   │   │   ├── github-sync/        # GitHub activity sync
│   │   │   ├── reset-freezes/      # Monthly freeze reset
│   │   │   ├── reset-streaks/      # Daily streak reset
│   │   │   └── streak-warning/     # Daily streak expiry warning
│   │   ├── email-preferences/      # Email opt-in/out
│   │   ├── endorsements/           # Project endorsements
│   │   ├── github/contributions/   # GitHub contribution data
│   │   ├── hire/                   # Hire requests & messages
│   │   ├── leaderboard/            # Rankings
│   │   ├── notifications/          # In-app notifications
│   │   ├── profile-views/          # Profile view tracking
│   │   ├── projects/               # CRUD + verify projects
│   │   ├── report/                 # Project reporting
│   │   ├── reviews/                # Builder reviews
│   │   ├── streak/                 # Log & get streak
│   │   ├── users/[username]/       # User profiles
│   │   └── v1/                     # Public API (builders, hire, openapi)
│   ├── agent/                      # AI talent finder
│   ├── auth/                       # Login, signup, callback, profile setup
│   ├── dashboard/                  # Profile & project management
│   ├── explore/                    # Vibecoder marketplace
│   ├── hire/chat/[requestId]/      # Hire request chat
│   ├── leaderboard/                # Rankings
│   ├── profile/[username]/         # Public profiles
│   ├── llms.txt/                   # LLM-readable site info
│   └── page.tsx                    # Landing page
├── components/
│   ├── agent/                      # AI agent chat UI
│   ├── auth/                       # Auth forms
│   ├── dashboard/                  # Dashboard widgets
│   ├── explore/                    # Explore filters & grid
│   ├── layout/                     # Navbar, footer
│   ├── leaderboard/                # Leaderboard table
│   ├── profile/                    # Profile sections (reviews, sidebar, share card)
│   └── ui/                         # Shared UI (project card, badge, hire modal, etc.)
└── lib/
    ├── client-outcomes.ts          # Client outcome metrics
    ├── cron-jobs/                   # Email digest logic (weekly, milestones, profile views)
    ├── email.ts                    # Email templates (Resend)
    ├── github-quality.ts           # GitHub repo quality scoring
    ├── notifications.ts            # In-app notification helpers
    ├── rate-limit.ts               # Upstash rate limiting
    ├── streak.ts                   # Streak, score, badge logic
    ├── supabase/
    │   ├── admin.ts                # Shared admin client (service role)
    │   ├── client.ts               # Browser client
    │   ├── server.ts               # Server client (cookie-based)
    │   └── server-queries.ts       # Cached server queries
    ├── validation.ts               # Shared input validation
    └── types/
        └── database.ts             # TypeScript types
```

## Core Systems

### Vibe Score

```text
Vibe Score = (Current Streak x 2) + (Projects Built x 5) + Badge Bonus
```

Badge bonuses: Bronze +10, Silver +20, Gold +30, Diamond +40

### Badge System

| Badge   | Requirement    |
|---------|---------------|
| Bronze  | 30-day streak |
| Silver  | 90-day streak |
| Gold    | 180-day streak |
| Diamond | 365-day streak |

### Streak System

- Log coding activity daily to maintain your streak
- Missing a day resets the streak to 0 (unless you have a streak freeze)
- Streak freezes: up to 2 per month, reset on the 1st
- Streak warning emails sent at 6 PM UTC for at-risk users

### GitHub Quality Score

Per-project score based on repo health: community engagement, code substance, and maintenance activity. Live URLs are checked weekly via cron.

### Endorsements

Authenticated users can endorse projects. Anti-gaming rules: can't endorse own projects, 7-day account age minimum, 10 endorsements/day limit, 30 requests/hour rate limit.

### Hire System

Clients can send hire requests to builders. Includes real-time chat, email notifications, and rate limiting.

## Pages

| Route | Description |
|---|---|
| `/` | Landing page with FAQ, stats, featured projects |
| `/explore` | Browse and filter builders |
| `/leaderboard` | Rankings by vibe score |
| `/profile/[username]` | Public builder profile |
| `/dashboard` | Manage profile, projects, streaks, notifications |
| `/agent` | AI-powered talent finder |
| `/hire/chat/[requestId]` | Hire request conversation |

## API Routes

| Endpoint | Method | Description |
|---|---|---|
| `/api/streak` | GET/POST | Get or log streak |
| `/api/leaderboard` | GET | Ranked vibecoders |
| `/api/projects` | GET/POST/PUT/DELETE | CRUD projects |
| `/api/projects/verify` | POST | Verify project ownership |
| `/api/hire` | POST | Send hire request |
| `/api/hire/messages` | GET/POST | Hire chat messages |
| `/api/reviews` | GET/POST/DELETE | Builder reviews |
| `/api/endorsements` | GET/POST/DELETE | Project endorsements |
| `/api/notifications` | GET/PATCH | In-app notifications |
| `/api/profile-views` | POST | Track profile views |
| `/api/email-preferences` | GET/PUT | Email opt-in/out |
| `/api/v1/builders` | GET | Public API: search builders |
| `/api/v1/builders/[username]` | GET | Public API: builder profile |
| `/api/v1/hire` | POST | Public API: send hire request |

## Cron Jobs

Configured in `vercel.json`. All protected by `CRON_SECRET`.

| Scheduled Path | Schedule | Description |
|---|---|---|
| `/api/cron/daily` | Daily 06:00 UTC | Orchestrator — fans out to reset-streaks, streak-warning, github-sync, reset-freezes |
| `/api/cron/check-live-urls` | Weekly Sun 03:00 UTC | Verify project live URLs |

## Security

- **RLS policies** block anonymous PostgREST inserts on sensitive tables
- **Database constraints** enforce minimum message length, valid email format, and name length on hire requests
- Privileged/public-write endpoints use `createAdminClient()` (requires `SUPABASE_SERVICE_ROLE_KEY`); authenticated user mutations use session-scoped clients with RLS
- Rate limiting via Upstash Redis on hire, endorsement, and review endpoints
- Input validation via shared utilities (`src/lib/validation.ts`)

## Deploy to Vercel

1. Push to GitHub
2. Import on [vercel.com](https://vercel.com)
3. Add all environment variables from `.env.local.example`
4. Deploy

Cron jobs are auto-configured via `vercel.json`.
