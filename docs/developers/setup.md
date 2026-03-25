# Getting Started

## Prerequisites

- **Node.js** 18+ (LTS recommended)
- **npm** or **yarn**
- **Supabase** account ([supabase.com](https://supabase.com))
- **Git**

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/vibe-talent.git
cd vibe-talent
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Create a `.env.local` file in the project root:

```env
# Required — Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Required — Site URL
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Optional — Email notifications
RESEND_API_KEY=re_...

# Optional — Rate limiting
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# Optional — Analytics
NEXT_PUBLIC_GA_ID=G_...

# Optional — Cron job protection
CRON_SECRET=your-secret-string

# Optional — Service role (for server-side operations)
SUPABASE_SERVICE_ROLE_KEY=...
```

### 4. Set Up Supabase

#### Create Tables

Run the SQL migrations in your Supabase SQL Editor. The schema includes these tables:

- `users` — Builder profiles and scores
- `projects` — Shipped project portfolios
- `streak_logs` — Daily activity records
- `social_links` — Builder contact info
- `hire_requests` — Client inquiries
- `hire_messages` — Chat threads
- `reviews` — Client feedback
- `project_reports` — Spam reports

See the [Database Schema](database-schema.md) section for the full SQL.

#### Enable Auth Providers

In your Supabase Dashboard under **Authentication > Providers**, enable:

- **GitHub** — Create an OAuth app at [github.com/settings/developers](https://github.com/settings/developers)
- **Google** — Set up OAuth credentials in [Google Cloud Console](https://console.cloud.google.com/)

Set the callback URL to: `https://your-project.supabase.co/auth/v1/callback`

#### Enable Row Level Security

RLS is critical for data protection. See [Authentication & Security](authentication-and-security.md) for all RLS policies.

#### Create Storage Bucket

Create a public bucket called `project-images` in Supabase Storage for project image uploads.

### 5. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 6. Run Tests

```bash
npm test
```

Tests cover streak calculations, rate limiting, and agent scoring logic.

## Project Structure

```
src/
├── app/                    # Next.js App Router pages & API routes
│   ├── api/                # Backend API endpoints
│   ├── auth/               # Login, signup, profile setup
│   ├── agent/              # AI matching interface
│   ├── dashboard/          # Authenticated builder dashboard
│   ├── explore/            # Public talent marketplace
│   ├── leaderboard/        # Public rankings
│   ├── profile/[username]/ # Public builder profiles
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Landing page
├── components/             # Reusable React components
│   ├── layout/             # Navbar, Footer
│   ├── ui/                 # Cards, buttons, heatmap
│   ├── profile/            # Profile sections
│   ├── explore/            # Explore filters
│   ├── leaderboard/        # Rankings display
│   └── agent/              # AI chat components
├── lib/                    # Shared utilities
│   ├── supabase/           # Database clients & queries
│   ├── types/              # TypeScript type definitions
│   ├── streak.ts           # Streak calculation logic
│   ├── rate-limit.ts       # Redis rate limiting
│   ├── email.ts            # Resend email integration
│   └── agent-scoring.ts    # AI evaluation logic
└── middleware.ts            # Auth middleware
```
