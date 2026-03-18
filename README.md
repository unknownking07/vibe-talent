# VibeTalent

A marketplace for vibecoders who actually ship. Build your reputation through consistency, streaks, and proof of work.

## Tech Stack

- **Next.js 16** (App Router)
- **TypeScript**
- **Tailwind CSS v4**
- **Supabase** (Auth + Database)
- **Lucide React** (Icons)

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the schema in `supabase/schema.sql`
3. Copy your project URL and anon key from **Settings > API**

### 3. Configure environment variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your Supabase credentials:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

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
│   │   ├── leaderboard/route.ts   # Leaderboard rankings
│   │   ├── projects/route.ts      # CRUD projects
│   │   ├── streak/route.ts        # Log & get streak
│   │   └── users/[username]/route.ts
│   ├── dashboard/page.tsx         # Profile & project management
│   ├── explore/page.tsx           # Vibecoder marketplace
│   ├── leaderboard/page.tsx       # Rankings
│   ├── profile/[username]/page.tsx
│   ├── layout.tsx
│   └── page.tsx                   # Landing page
├── components/
│   ├── layout/
│   │   ├── navbar.tsx
│   │   └── footer.tsx
│   └── ui/
│       ├── activity-heatmap.tsx
│       ├── badge-display.tsx
│       ├── project-card.tsx
│       ├── streak-counter.tsx
│       ├── vibe-score.tsx
│       └── vibecoder-card.tsx
└── lib/
    ├── mock-data.ts
    ├── streak.ts                  # Streak/score/badge logic
    ├── supabase/
    │   ├── client.ts
    │   └── server.ts
    └── types/
        └── database.ts
```

## Core Systems

### Vibe Score Formula

```
Vibe Score = (Current Streak × 2) + (Projects Built × 5) + Badge Bonus
```

Badge bonuses: Bronze +10, Silver +20, Gold +30, Diamond +40

### Badge System

| Badge   | Requirement     |
|---------|----------------|
| Bronze  | 30-day streak  |
| Silver  | 90-day streak  |
| Gold    | 180-day streak |
| Diamond | 365-day streak |

### Streak Logic

- Log coding activity daily to maintain your streak
- Missing a day resets the streak to 0
- Longest streak is preserved for badge calculations

## Pages

| Route                | Description              |
|---------------------|--------------------------|
| `/`                 | Landing page             |
| `/explore`          | Vibecoder marketplace    |
| `/profile/[username]` | Public profile         |
| `/leaderboard`      | Rankings                 |
| `/dashboard`        | Manage profile/projects  |

## API Routes

| Endpoint                  | Method | Description            |
|--------------------------|--------|------------------------|
| `/api/streak`            | GET    | Get user streak info   |
| `/api/streak`            | POST   | Log daily activity     |
| `/api/leaderboard`       | GET    | Get ranked vibecoders  |
| `/api/projects`          | GET    | List projects          |
| `/api/projects`          | POST   | Create a project       |
| `/api/users/[username]`  | GET    | Get user profile       |

## Deploy to Vercel

1. Push your code to GitHub
2. Import the repo on [vercel.com](https://vercel.com)
3. Add environment variables in Vercel project settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy

The app is pre-configured for Vercel with zero additional setup needed.
