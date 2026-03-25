# VibeCoders — Product Requirements Document

**Version:** 1.0
**Date:** March 17, 2026
**Author:** VibeCoders Product Team
**Status:** In Development

---

## 1. Executive Summary

VibeCoders is a developer marketplace that ranks and connects talent based on **consistency and proof of work** rather than traditional resumes, certifications, or interview performance. The platform introduces a reputation system built on daily coding streaks, shipped projects, and a composite "Vibe Score" — creating an unfakeable track record that clients can trust.

The core insight: **the best predictor of future output is past consistency.** VibeCoders makes that consistency visible, measurable, and hireable.

### 1.1 Problem Statement

The current freelance developer hiring market is broken in three ways:

1. **Signal-to-noise ratio is terrible.** Platforms like Fiverr and Upwork rank by reviews and price, not by actual proof of consistent output. A developer with a polished portfolio but no shipping habit ranks equally to one who ships daily.

2. **Resumes and portfolios are fakeable.** Anyone can build a portfolio in a weekend or inflate a resume. There is no verifiable, continuous signal that a developer shows up and delivers consistently.

3. **Clients have no way to assess reliability.** The #1 risk in hiring a freelance developer isn't skill — it's ghosting, missed deadlines, and inconsistent communication. Clients need a signal for reliability, not just competence.

### 1.2 Solution

VibeCoders solves this by creating a **reputation layer built on streaks, shipped projects, and gamified consistency metrics.** Every vibecoder has a public profile that shows:

- How many consecutive days they've coded (streak)
- How many projects they've shipped (portfolio)
- A composite reputation score (Vibe Score)
- Earned badges that prove sustained consistency over 30, 90, 180, and 365 days

This creates a marketplace where the most consistent builders rise to the top — not the ones with the best marketing or lowest prices.

### 1.3 Target Users

| Persona | Description | Primary Need |
|---------|-------------|--------------|
| **Vibecoder** | Independent developer, indie hacker, or builder who codes daily and ships projects regularly | Showcase consistency, build reputation, get discovered by clients |
| **Client** | Startup founder, project manager, or business owner looking to hire a reliable developer | Find developers with a proven track record of consistent delivery |
| **Community Member** | Developer who wants to build a coding habit and track progress | Gamified motivation system with streaks, badges, and leaderboards |

---

## 2. Product Vision

### 2.1 Vision Statement

> **Build the reputation layer for the next generation of developers — where your streak is your resume and your shipped projects are your proof.**

### 2.2 Mission

To create the most trusted marketplace for hiring developers by making consistency visible, verifiable, and rewarded.

### 2.3 Success Metrics (North Stars)

| Metric | Target (6 months) | Target (12 months) |
|--------|-------------------|---------------------|
| Registered vibecoders | 5,000 | 25,000 |
| Daily active loggers (streak users) | 1,500 | 8,000 |
| Average streak length | 30 days | 60 days |
| Client inquiries sent | 500/month | 3,000/month |
| Vibecoders with 90+ day streaks | 200 | 1,500 |
| Platform GMV (if payments added) | — | $500K/month |

### 2.4 Competitive Landscape

| Platform | Ranking Signal | Weakness VibeCoders Solves |
|----------|---------------|---------------------------|
| Fiverr | Reviews, price | No proof of consistency; reviews are gameable |
| Upwork | Job success score, hours | Penalizes specialists; favors volume over quality |
| Toptal | Screening process | Gatekeeping; no ongoing proof of activity |
| GitHub | Contribution graph | Not a marketplace; no hiring flow |
| LinkedIn | Endorsements, experience | Self-reported; no verification of actual output |

**VibeCoders' moat:** The streak and Vibe Score system creates a reputation that compounds over time and cannot be faked. A 365-day Diamond badge is proof of a year of consistent work — no other platform offers this signal.

---

## 3. Core Features

### 3.1 User Profiles

**Priority:** P0 (Must Have)

Every vibecoder has a public profile that serves as their hiring page.

#### Profile Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| username | string | Yes | Unique handle, used in URL (`/profile/[username]`) |
| email | string | Yes | Private, used for auth and notifications |
| bio | text | No | Short description, max 280 characters |
| avatar_url | string | No | Profile photo URL |
| streak | integer | Auto | Current consecutive day streak |
| longest_streak | integer | Auto | All-time longest streak |
| vibe_score | integer | Auto | Composite reputation score |
| badge_level | enum | Auto | none / bronze / silver / gold / diamond |

#### Social Integrations

| Platform | Field | URL Pattern |
|----------|-------|-------------|
| X (Twitter) | twitter | `x.com/{handle}` |
| GitHub | github | `github.com/{handle}` |
| Telegram | telegram | `t.me/{handle}` |
| Personal Website | website | Direct URL |
| Farcaster | farcaster | `warpcast.com/{handle}` |

#### Profile Page Components

1. **Header** — Avatar, username, badge, bio
2. **Stats Row** — Current streak, longest streak, Vibe Score, project count, join date
3. **Social Links** — Clickable buttons for all connected platforms
4. **Hire Button** — Prominent CTA: "Hire This Vibecoder"
5. **Activity Heatmap** — GitHub-style contribution graph (52 weeks)
6. **Project Portfolio** — Grid of shipped projects with tech stack, links, and build time

#### Acceptance Criteria

- [ ] Profile page loads in under 2 seconds
- [ ] All stats update in real-time when streak is logged
- [ ] Profile is accessible via `/profile/[username]` with SEO-friendly meta tags
- [ ] Social links open in new tabs with `noopener noreferrer`
- [ ] "Hire This Vibecoder" button triggers contact flow
- [ ] Activity heatmap renders 52 weeks of data with 4 intensity levels
- [ ] Profile works fully on mobile (responsive)

---

### 3.2 Vibecoding Streak System

**Priority:** P0 (Must Have)

The streak system is the core engagement loop and the foundation of the reputation model.

#### How Streaks Work

1. A vibecoder logs their coding activity (or publishes a project)
2. If they log activity on consecutive calendar days, their streak increments
3. If they miss a single day, the streak resets to 0
4. The longest streak is preserved permanently and determines badge level

#### Streak Rules

| Rule | Behavior |
|------|----------|
| Activity logged today | Streak continues (no increment if already logged today) |
| Activity logged yesterday + today | Streak increments by 1 |
| No activity yesterday | Streak resets to 0 |
| Multiple logs same day | Counted as 1 day (deduplicated by `activity_date`) |
| Timezone handling | Based on UTC date boundaries |

#### Data Model

```
streak_logs
├── id: UUID (PK)
├── user_id: UUID (FK → users)
├── activity_date: DATE
└── UNIQUE(user_id, activity_date)
```

#### Streak Calculation Algorithm

```
Input: sorted list of activity dates for a user
Output: { currentStreak, longestStreak }

1. Deduplicate dates
2. Sort ascending
3. Walk forward, counting consecutive days (diff = 1)
4. Track longest run seen
5. For current streak: check if last activity is today or yesterday
   - If yes: walk backward from end counting consecutive days
   - If no: current streak = 0
```

#### Auto-Update Trigger

When a new `streak_log` is inserted, a database trigger automatically:
1. Recalculates `currentStreak` and `longestStreak`
2. Updates `badge_level` based on `longestStreak`
3. Recalculates `vibe_score`

#### Acceptance Criteria

- [ ] Logging activity is idempotent (multiple clicks same day = 1 log)
- [ ] Streak resets correctly after a missed day
- [ ] Longest streak never decreases
- [ ] Streak calculation handles timezone edge cases
- [ ] Activity log button shows confirmation state after logging
- [ ] Streak counter updates immediately in the UI

---

### 3.3 Badge System

**Priority:** P0 (Must Have)

Badges are permanent achievements earned through sustained streak consistency.

#### Badge Tiers

| Badge | Requirement | Color | Bonus Points |
|-------|------------|-------|-------------|
| None | < 30 day streak | Gray | 0 |
| Bronze | 30+ day streak | Amber | +10 |
| Silver | 90+ day streak | Silver | +20 |
| Gold | 180+ day streak | Gold | +30 |
| Diamond | 365+ day streak | Cyan | +40 |

#### Badge Behavior

- Badges are earned based on `longest_streak`, not `current_streak`
- Once earned, a badge is **never revoked** (even if streak resets)
- Badge level is determined by the highest qualifying tier
- Badges appear on: profile page, marketplace cards, leaderboard entries

#### Badge Display Locations

1. Profile header (next to username)
2. Vibecoder cards on Explore page
3. Leaderboard table rows
4. Podium cards on Leaderboard page

#### Acceptance Criteria

- [ ] Badge upgrades automatically when longest streak crosses a threshold
- [ ] Badge is never downgraded
- [ ] Badge renders with correct icon, color, and label at all sizes (sm/md/lg)
- [ ] Badge tooltip shows the requirement (e.g., "90 day streak")

---

### 3.4 Vibe Score System

**Priority:** P0 (Must Have)

The Vibe Score is the single composite metric that represents a vibecoder's overall reputation. It balances **consistency** (are you showing up?) with **quality** (are you shipping real, polished work?).

#### Formula

```
Vibe Score = (Current Streak × 2) + Σ Project Quality Scores + Badge Bonus + Review Bonus
```

#### Component Breakdown

| Component | How It Works | Rationale |
|-----------|-------------|-----------|
| Current Streak | ×2 per day | Rewards active, ongoing consistency |
| Project Quality Score | Up to 15 pts per verified project | Rewards polished, complete project listings |
| Badge Bonus | +10/20/30/40 | Rewards historical consistency milestones |
| Review Bonus | avg_rating × count × 2, max 50 | Rewards real client satisfaction |

#### Per-Project Quality Scoring

Verified projects earn bonus points based on completeness. This ensures that quality project listings are worth significantly more than bare-bones entries.

| Quality Signal | Points | Condition |
|----------------|--------|-----------|
| Base (verified) | 5 pts | Project has verified GitHub ownership |
| Base (unverified) | 1 pt | Any project without verification |
| Live URL | +3 pts | Deployed project link present |
| GitHub URL | +2 pts | Source code repository linked |
| Detailed description | +2 pts | Description longer than 50 characters |
| Screenshot/image | +1 pt | Preview image uploaded |
| Tech stack breadth | +2 pts | 3 or more technologies listed |
| **Max per verified project** | **15 pts** | |

#### Review Bonus

Client reviews directly impact a builder's Vibe Score:

```
Review Bonus = MIN(50, ROUND(avg_rating × review_count × 2))
```

| Reviews | Avg Rating | Bonus |
|---------|-----------|-------|
| 1 review | 5 stars | 10 pts |
| 3 reviews | 5 stars | 30 pts |
| 5 reviews | 5 stars | 50 pts (cap) |
| 3 reviews | 3 stars | 18 pts |

#### 3.4.1 Quality vs Consistency Balance

**Design Philosophy:** Consistency gets you noticed. Quality makes you hireable.

The Vibe Score is intentionally designed so that both signals carry weight:

- **Consistency** (streaks + badges) creates a reliable baseline. Clients trust builders who show up every day.
- **Quality** (project completeness + reviews) differentiates the best builders. A polished project with a live demo, verified code, and a 5-star review is worth more than a week of streak points.

This means a builder with fewer streak days but excellent shipped projects and great reviews can outrank a pure streak grinder. The leaderboard rewards builders who **deliver**, not just those who log in.

**Example comparison:**

| Builder | Streak | Projects (verified, full) | Reviews | Score |
|---------|--------|--------------------------|---------|-------|
| Streak grinder | 100 days | 2 (unverified, bare) | None | (100×2) + (2×1) + 0 + 0 = **202** |
| Quality shipper | 30 days | 5 (verified, complete) | 3 × 5-star | (30×2) + (5×15) + 10 + 30 = **175** |

The streak grinder leads initially — but their score is fragile (one missed day and streak points vanish). The quality shipper's score is resilient: projects, badges, and reviews persist permanently.

#### Example Calculations

| Vibecoder | Streak | Projects | Badge | Reviews | Score |
|-----------|--------|----------|-------|---------|-------|
| New user | 5 | 1 unverified | None | None | (5×2) + 1 + 0 + 0 = **11** |
| Active builder | 45 | 3 verified (full) | Bronze | None | (45×2) + (3×15) + 10 + 0 = **145** |
| Quality shipper | 30 | 5 verified (full) | Bronze | 3 × 5-star | (30×2) + (5×15) + 10 + 30 = **175** |
| Diamond vibecoder | 380 | 10 verified (full) | Diamond | 5 × 5-star | (380×2) + (10×15) + 40 + 50 = **1000** |

#### Future Score Enhancements (V2)

| Bonus | Points | Condition |
|-------|--------|-----------|
| GitHub stars | +2 per 10 stars | Verified via GitHub API |
| Community upvotes | +1 per upvote | Peer validation of project quality |
| Hire completion rate | +10 per completed hire | Tracks actual delivery |
| Verified identity | +25 (one-time) | KYC or social verification |

#### Acceptance Criteria

- [ ] Vibe Score recalculates on every streak log, project change, and review submission
- [ ] Score is displayed with lightning bolt icon and purple accent
- [ ] Score updates are reflected immediately across all pages
- [ ] Score cannot go negative
- [ ] Quality signals (project completeness) are factored into per-project scoring
- [ ] Review bonus is capped at 50 points

---

### 3.5 Leaderboard

**Priority:** P0 (Must Have)

The leaderboard is the competitive layer that drives engagement and discovery.

#### Page: `/leaderboard`

#### Ranking Modes

| Tab | Sort Field | Description |
|-----|-----------|-------------|
| Vibe Score | `vibe_score DESC` | Overall reputation ranking |
| Longest Streak | `longest_streak DESC` | Most consistent coders |
| Most Projects | `COUNT(projects) DESC` | Most prolific shippers |

#### Layout

1. **Podium** — Top 3 vibecoders displayed prominently
   - #1 in center (larger avatar, gold accent)
   - #2 on left, #3 on right
2. **Table** — Remaining vibecoders ranked #4+
   - Columns: Rank, User, Vibe Score, Streak, Projects, Badge

#### Leaderboard Card Data

- Avatar (initials fallback)
- Username (linked to profile)
- Vibe Score
- Current streak
- Badge level
- Project count

#### Acceptance Criteria

- [ ] Default sort is by Vibe Score
- [ ] Tab switching re-sorts without page reload
- [ ] Podium shows top 3 with visual hierarchy (#1 elevated)
- [ ] Table rows link to user profiles
- [ ] Mobile: table columns gracefully collapse (hide streak/projects)

---

### 3.6 Project Showcase

**Priority:** P0 (Must Have)

Projects are the tangible proof of work that backs up a vibecoder's streak.

#### Project Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| title | string | Yes | Project name |
| description | text | Yes | What the project does |
| tech_stack | string[] | No | Technologies used (tags) |
| live_url | URL | No | Deployed project link |
| github_url | URL | No | Source code repository |
| image_url | URL | No | Preview screenshot |
| build_time | string | No | How long it took (e.g., "2 days") |
| tags | string[] | No | Categorization tags (e.g., "AI", "SaaS") |

#### Project Display

- **On Profile** — Grid of project cards with tech stack tags, links, and build time
- **On Explore** — Project names shown on vibecoder cards (max 3)
- **On Landing** — Featured projects section

#### CRUD Operations

| Action | Endpoint | Auth Required |
|--------|----------|---------------|
| List all projects | `GET /api/projects` | No |
| Create project | `POST /api/projects` | Yes (owner) |
| Update project | `PUT /api/projects/[id]` | Yes (owner) |
| Delete project | `DELETE /api/projects/[id]` | Yes (owner) |

#### Acceptance Criteria

- [ ] Projects are created from the Dashboard
- [ ] Tech stack renders as colored tags
- [ ] Live URL and GitHub URL open in new tabs
- [ ] Adding/removing a project immediately updates Vibe Score
- [ ] Projects display in reverse chronological order

---

### 3.7 Marketplace Discovery (Explore)

**Priority:** P0 (Must Have)

The Explore page is where clients discover and evaluate vibecoders.

#### Page: `/explore`

#### Search

- Full-text search across: username, bio, tech stack, project tags
- Debounced input (300ms)
- Results update instantly (client-side filtering for V1, server-side for V2)

#### Filters

| Filter | Options |
|--------|---------|
| Badge Level | All, Diamond, Gold, Silver, Bronze, None |
| Sort By | Highest Vibe Score, Longest Streak, Most Projects, Newest |

#### Future Filters (V2)

| Filter | Options |
|--------|---------|
| Tech Stack | Multi-select from known technologies |
| Minimum Streak | Slider (0–365+) |
| Minimum Vibe Score | Slider (0–1000+) |
| Availability | Available Now, Busy |
| Rate Range | $/hr slider |

#### Result Cards

Each vibecoder card shows:
- Avatar + username
- Badge level
- Bio (2-line truncated)
- Current streak (flame icon)
- Vibe Score (lightning icon)
- Project count
- Top 3 project names

#### Acceptance Criteria

- [ ] Search returns results in under 200ms
- [ ] Empty state shows "No vibecoders match" with clear filters option
- [ ] Cards link to full profile page
- [ ] Filter state persists during the session
- [ ] Mobile: cards stack in single column

---

### 3.8 Contact System

**Priority:** P1 (Should Have)

Clients can reach vibecoders through their connected social channels.

#### V1: External Contact

- "Hire This Vibecoder" button on profile page
- Clicking opens a modal/dropdown with available contact methods:
  - X (Twitter) DM
  - Telegram message
  - Email (if provided)
  - Website link
- All links open externally

#### V2: Built-in Messaging (Future)

| Feature | Description |
|---------|-------------|
| Inquiry form | Client fills out project brief on-platform |
| Inbox | Vibecoders receive and respond to inquiries |
| Status tracking | Inquiry → Discussion → Hired → Completed |
| Notifications | Email + in-app notifications for new inquiries |

#### V3: Payments & Escrow (Future)

| Feature | Description |
|---------|-------------|
| Rate setting | Vibecoders set hourly/project rates |
| Escrow | Platform holds payment until milestones delivered |
| Invoicing | Auto-generated invoices |
| Stripe Connect | Payouts to vibecoders |

---

### 3.9 Gamification Features

**Priority:** P1 (Should Have)

Gamification drives daily engagement and retention.

#### Current Gamification Elements

| Element | Location | Purpose |
|---------|----------|---------|
| Streak Counter | Profile, Dashboard, Cards | Daily engagement loop |
| Badge System | Profile, Cards, Leaderboard | Long-term milestone rewards |
| Vibe Score | Profile, Cards, Leaderboard | Composite reputation metric |
| Activity Heatmap | Profile, Dashboard | Visual proof of consistency |
| Leaderboard | `/leaderboard` | Competition and discovery |

#### Future Gamification (V2)

| Element | Description |
|---------|-------------|
| Weekly challenges | "Ship a project this week" with bonus points |
| Achievement unlocks | "First project shipped", "100 Vibe Score", etc. |
| Streak shields | 1 free miss per month (earned at Silver+) |
| Referral bonuses | +50 Vibe Score for each referred vibecoder |
| Seasonal rankings | Quarterly leaderboard resets with prizes |

---

### 3.10 Dashboard

**Priority:** P0 (Must Have)

The Dashboard is the vibecoder's control center.

#### Page: `/dashboard`

#### Sections

1. **Stats Overview** — 4 metric cards (Current Streak, Longest Streak, Vibe Score, Projects)
2. **Log Activity** — One-click button to log today's coding activity + streak display
3. **Activity Heatmap** — 52-week contribution graph
4. **Edit Profile** — Form for username, bio, and all social links
5. **Projects** — List of existing projects + "Add Project" form

#### Acceptance Criteria

- [ ] Stats cards update immediately after logging activity
- [ ] Log Activity button is idempotent and shows confirmation
- [ ] Profile form saves with validation feedback
- [ ] Project form supports comma-separated tech stack and tags
- [ ] All forms show loading states during submission

---

## 4. Information Architecture

### 4.1 Page Map

```
/                          Landing page
├── /explore               Vibecoder marketplace
├── /leaderboard           Rankings (3 tabs)
├── /dashboard             Profile & project management (auth required)
├── /profile/[username]    Public vibecoder profile
├── /projects/[id]         Individual project page (V2)
├── /auth/login            Login page (V2)
├── /auth/signup           Registration page (V2)
└── /settings              Account settings (V2)
```

### 4.2 Navigation

| Element | Items |
|---------|-------|
| Primary Nav | Explore, Leaderboard, Dashboard |
| CTA Button | "Create Profile" (links to Dashboard) |
| Logo | Links to Landing page |
| Footer | Platform links, Resources, Copyright |

---

## 5. Database Schema

### 5.1 Entity Relationship Diagram

```
users (1) ──── (N) projects
users (1) ──── (N) streak_logs
users (1) ──── (1) social_links
```

### 5.2 Tables

#### `users`

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| id | UUID | PK | `uuid_generate_v4()` |
| username | TEXT | UNIQUE, NOT NULL | — |
| email | TEXT | UNIQUE, NOT NULL | — |
| bio | TEXT | — | NULL |
| avatar_url | TEXT | — | NULL |
| streak | INTEGER | — | 0 |
| longest_streak | INTEGER | — | 0 |
| vibe_score | INTEGER | — | 0 |
| badge_level | ENUM | — | 'none' |
| created_at | TIMESTAMPTZ | — | `NOW()` |

#### `projects`

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| id | UUID | PK | `uuid_generate_v4()` |
| user_id | UUID | FK → users, NOT NULL | — |
| title | TEXT | NOT NULL | — |
| description | TEXT | NOT NULL | — |
| tech_stack | TEXT[] | — | `'{}'` |
| live_url | TEXT | — | NULL |
| github_url | TEXT | — | NULL |
| image_url | TEXT | — | NULL |
| build_time | TEXT | — | NULL |
| tags | TEXT[] | — | `'{}'` |
| created_at | TIMESTAMPTZ | — | `NOW()` |

#### `streak_logs`

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| id | UUID | PK | `uuid_generate_v4()` |
| user_id | UUID | FK → users, NOT NULL | — |
| activity_date | DATE | NOT NULL | — |
| — | — | UNIQUE(user_id, activity_date) | — |

#### `social_links`

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| id | UUID | PK | `uuid_generate_v4()` |
| user_id | UUID | FK → users, UNIQUE, NOT NULL | — |
| twitter | TEXT | — | NULL |
| telegram | TEXT | — | NULL |
| github | TEXT | — | NULL |
| website | TEXT | — | NULL |
| farcaster | TEXT | — | NULL |

### 5.3 Indexes

| Index | Table | Columns | Purpose |
|-------|-------|---------|---------|
| idx_users_username | users | username | Profile lookups |
| idx_users_vibe_score | users | vibe_score DESC | Leaderboard sorting |
| idx_users_streak | users | streak DESC | Leaderboard sorting |
| idx_users_badge_level | users | badge_level | Explore filtering |
| idx_projects_user_id | projects | user_id | Profile project loading |
| idx_streak_logs_user_date | streak_logs | user_id, activity_date | Streak calculation |

### 5.4 Row Level Security

| Table | Policy | Description |
|-------|--------|-------------|
| users | SELECT → public | Anyone can view profiles |
| users | UPDATE → owner only | Only the user can edit their profile |
| projects | SELECT → public | Anyone can view projects |
| projects | INSERT/UPDATE/DELETE → owner | Only the user can manage their projects |
| streak_logs | SELECT/INSERT → owner | Only the user can view/log their streaks |
| social_links | SELECT → public | Anyone can view social links |
| social_links | ALL → owner | Only the user can manage their links |

---

## 6. API Specification

### 6.1 Endpoints

#### Streak

```
GET  /api/streak?user_id={id}
Response: { user_id, current_streak, longest_streak, badge_level, vibe_score }

POST /api/streak
Body: { user_id }
Response: { success, activity_date, message }
```

#### Leaderboard

```
GET  /api/leaderboard?sort={vibe_score|streak|projects}&limit={n}
Response: { leaderboard: [{ rank, id, username, vibe_score, streak, badge_level, project_count }] }
```

#### Users

```
GET  /api/users/{username}
Response: { user: { ...profile, social_links, projects } }
```

#### Projects

```
GET  /api/projects
Response: { projects: [...] }

POST /api/projects
Body: { user_id, title, description, tech_stack?, live_url?, github_url?, build_time?, tags? }
Response: { project: { ...created_project } }
```

---

## 7. Technical Architecture

### 7.1 Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Framework | Next.js 16 (App Router) | SSR, API routes, file-based routing |
| Language | TypeScript | Type safety, better DX |
| Styling | Tailwind CSS v4 | Utility-first, dark mode, rapid iteration |
| Database | Supabase (PostgreSQL) | Auth, RLS, real-time, hosted |
| Auth | Supabase Auth | OAuth providers, JWT, session management |
| Icons | Lucide React | Consistent, tree-shakeable icon set |
| Deployment | Vercel | Zero-config Next.js hosting |
| Caching (V2) | Redis (Upstash) | Streak calculation caching |

### 7.2 Architecture Diagram

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│   Client    │────▶│  Next.js     │────▶│  Supabase    │
│  (Browser)  │◀────│  (Vercel)    │◀────│ (PostgreSQL) │
└─────────────┘     └──────────────┘     └──────────────┘
                          │                      │
                          │                      ├── Auth
                          ├── App Router         ├── Database
                          ├── API Routes         ├── RLS Policies
                          ├── Server Components  ├── Triggers
                          └── Client Components  └── Functions
```

### 7.3 Performance Targets

| Metric | Target |
|--------|--------|
| First Contentful Paint | < 1.5s |
| Largest Contentful Paint | < 2.5s |
| Time to Interactive | < 3.0s |
| Cumulative Layout Shift | < 0.1 |
| API Response Time (p95) | < 200ms |
| Lighthouse Score | > 90 |

---

## 8. Authentication & Authorization (V2)

### 8.1 Auth Flow

| Method | Provider |
|--------|----------|
| OAuth | GitHub (primary), Google, Twitter/X |
| Magic Link | Email-based passwordless login |

### 8.2 Auth States

| State | Access |
|-------|--------|
| Unauthenticated | Landing, Explore, Leaderboard, Public Profiles |
| Authenticated | Dashboard, Log Activity, Manage Projects, Edit Profile |

### 8.3 Authorization Matrix

| Action | Unauthenticated | Authenticated (Self) | Authenticated (Other) |
|--------|-----------------|---------------------|----------------------|
| View profiles | Yes | Yes | Yes |
| View leaderboard | Yes | Yes | Yes |
| Edit profile | No | Yes | No |
| Log streak | No | Yes | No |
| Add project | No | Yes | No |
| Contact vibecoder | Yes (external links) | Yes | Yes |

---

## 9. Roadmap

### Phase 1: MVP (Current — Weeks 1–4)

| Feature | Status |
|---------|--------|
| Landing page with hero and CTA | Done |
| User profiles with stats | Done |
| Streak system with daily logging | Done |
| Badge system (4 tiers) | Done |
| Vibe Score calculation | Done |
| Leaderboard (3 sort modes) | Done |
| Explore page with search and filters | Done |
| Project showcase | Done |
| Activity heatmap | Done |
| Dashboard with profile editing | Done |
| Supabase schema with RLS | Done |
| API routes | Done |
| Dark mode UI | Done |
| Mobile responsive | Done |
| Mock data for demo | Done |

### Phase 2: Auth & Live Data (Weeks 5–8)

| Feature | Priority |
|---------|----------|
| Supabase Auth (GitHub OAuth) | P0 |
| Real database connections (replace mock data) | P0 |
| User registration + onboarding flow | P0 |
| Image upload for avatars and projects | P1 |
| SEO meta tags (Open Graph, Twitter cards) | P1 |
| Email notifications (streak reminders) | P2 |

### Phase 3: Growth & Engagement (Weeks 9–12)

| Feature | Priority |
|---------|----------|
| GitHub integration (auto-detect activity) | P0 |
| Built-in messaging / inquiry system | P1 |
| Weekly challenges | P1 |
| Achievement system (beyond badges) | P2 |
| Streak shields (1 free miss/month for Silver+) | P2 |
| Public API for embedding vibe score | P2 |
| Referral system | P2 |

### Phase 4: Monetization (Weeks 13–20)

| Feature | Priority |
|---------|----------|
| Premium profiles (custom themes, analytics) | P1 |
| Client accounts with project posting | P1 |
| Payments via Stripe Connect | P1 |
| Escrow for project milestones | P2 |
| Featured placement (paid promotion) | P2 |
| Team profiles for agencies | P2 |

### Phase 5: Scale (Weeks 21+)

| Feature | Priority |
|---------|----------|
| Redis caching for leaderboard/streaks | P1 |
| Real-time leaderboard updates (Supabase Realtime) | P1 |
| Mobile app (React Native) | P2 |
| AI-powered matching (client needs → vibecoder skills) | P2 |
| Verified projects (deploy verification) | P2 |
| Community features (forums, Discord integration) | P3 |

---

## 10. Design Specifications

### 10.1 Design Principles

1. **Dark mode first** — Developers live in dark mode. The entire UI is designed dark-first.
2. **Data-dense but clean** — Show meaningful metrics without clutter.
3. **Developer-focused** — Monospace numbers, code-inspired layouts, minimal decorative elements.
4. **Gamification without gimmicks** — Badges and scores should feel earned, not childish.

### 10.2 Color System

| Token | Value | Usage |
|-------|-------|-------|
| Background | `#09090b` (zinc-950) | Page background |
| Surface | `zinc-900/50` | Cards, sections |
| Border | `zinc-800` | Card borders, dividers |
| Text Primary | `#fafafa` (zinc-50) | Headings, primary text |
| Text Secondary | `zinc-400` | Descriptions, labels |
| Text Muted | `zinc-500` | Metadata, timestamps |
| Accent Primary | `violet-600` | Buttons, active states, links |
| Accent Hover | `violet-500` | Button hover |
| Streak | `orange-400` | Flame icon, streak numbers |
| Vibe Score | `violet-400` | Lightning icon, score numbers |
| Heatmap | `emerald-400→900` | Activity intensity scale |
| Badge Bronze | `amber-600` | Bronze badge |
| Badge Silver | `slate-300` | Silver badge |
| Badge Gold | `yellow-400` | Gold badge |
| Badge Diamond | `cyan-300` | Diamond badge |

### 10.3 Typography

| Element | Font | Weight | Size |
|---------|------|--------|------|
| Headings | Geist Sans | Bold (700) | 3xl–7xl |
| Body | Geist Sans | Regular (400) | sm–base |
| Metrics | Geist Mono | Bold (700) | sm–2xl |
| Labels | Geist Sans | Medium (500) | xs |
| Badges | Geist Sans | Medium (500) | xs–base |

### 10.4 Component Library

| Component | Variants | Props |
|-----------|----------|-------|
| BadgeDisplay | sm, md, lg | `level`, `size`, `showLabel` |
| StreakCounter | sm, md, lg | `streak`, `size` |
| VibeScore | sm, md, lg | `score`, `size` |
| VibecoderCard | default, ranked | `user`, `rank?` |
| ProjectCard | default | `project` |
| ActivityHeatmap | default | `data` (date→level map) |
| Navbar | desktop, mobile | — |
| Footer | default | — |

---

## 11. Analytics & Tracking

### 11.1 Key Events

| Event | Trigger | Properties |
|-------|---------|------------|
| `page_view` | Page load | `path`, `referrer` |
| `streak_logged` | User logs activity | `user_id`, `streak_count` |
| `project_created` | User adds project | `user_id`, `tech_stack` |
| `profile_viewed` | Profile page visited | `viewed_user_id`, `viewer_id?` |
| `hire_clicked` | "Hire This Vibecoder" clicked | `vibecoder_id`, `contact_method` |
| `leaderboard_tab_changed` | Tab switch | `tab_name` |
| `explore_search` | Search query submitted | `query`, `result_count` |
| `explore_filter` | Filter applied | `filter_type`, `filter_value` |

### 11.2 Dashboards

| Dashboard | Metrics |
|-----------|---------|
| Growth | Signups/day, DAU, MAU, retention |
| Engagement | Streaks logged/day, avg streak length, badge distribution |
| Marketplace | Profile views, hire clicks, contact method breakdown |
| Content | Projects added/day, tech stack distribution |

---

## 12. Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Users game streaks (log without actually coding) | Medium | High | V2: GitHub integration for verified activity |
| Low initial supply (not enough vibecoders) | High | Medium | Seed with 100 invited power users; build community on X |
| Streak fatigue (users burn out) | Medium | Medium | Introduce streak shields at Silver+ tier |
| No demand side (clients don't come) | High | Medium | Content marketing; "hire vibecoders" SEO; partnerships |
| Database performance at scale | Medium | Low | Index optimization; Redis caching; connection pooling |
| Supabase rate limits | Low | Low | Upgrade plan; implement client-side caching |

---

## 13. Open Questions

| # | Question | Status | Decision |
|---|----------|--------|----------|
| 1 | Should streaks auto-detect from GitHub, or require manual logging? | Open | V1: Manual. V2: GitHub integration as opt-in enhancement. |
| 2 | Should we add hourly rates to profiles? | Open | Defer to V2. Keep V1 focused on reputation, not pricing. |
| 3 | Should badges be revocable if streak drops? | Decided | No — badges are permanent achievements. |
| 4 | Should we support team profiles? | Open | Defer to V4. Focus on individual vibecoders first. |
| 5 | What's the monetization model? | Open | Likely: Premium profiles + featured placement + transaction fee on hires. |
| 6 | Should we add a "streak freeze" for vacations? | Open | V2: Streak shields (1 per month at Silver+). |
| 7 | UTC vs user-local timezone for streak calculation? | Open | V1: UTC. V2: User-selectable timezone. |

---

## 14. Appendix

### 14.1 Glossary

| Term | Definition |
|------|------------|
| **Vibecoder** | A developer who practices vibe coding — building in flow state with consistency |
| **Vibe Coding** | The practice of shipping code daily in a flow-driven, streak-oriented manner |
| **Streak** | Consecutive calendar days with logged coding activity |
| **Vibe Score** | Composite reputation metric combining streak, projects, and badges |
| **Badge** | Permanent achievement earned by reaching streak milestones |

### 14.2 References

- GitHub Contribution Graph: Inspiration for Activity Heatmap
- Duolingo Streak System: Inspiration for daily engagement loop
- Fiverr / Upwork: Competitive marketplace analysis
- Steam Achievements: Inspiration for badge permanence model

---

*This document is a living artifact. It will be updated as decisions are made and features are shipped.*
