# Database Schema

VibeTalent uses **Supabase PostgreSQL** with Row Level Security (RLS) enabled on all tables. The schema is designed around the core concept: **builders earn reputation through consistent activity and shipped projects**.

## Entity Relationship Diagram

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│    users     │     │   projects   │     │ streak_logs  │
│──────────────│     │──────────────│     │──────────────│
│ id (PK)      │←──┐ │ id (PK)      │     │ id (PK)      │
│ username     │   ├─│ user_id (FK) │     │ user_id (FK) │──→ users
│ bio          │   │ │ title        │     │ activity_date│
│ avatar_url   │   │ │ description  │     │ (UNIQUE pair)│
│ streak       │   │ │ tech_stack[] │     └──────────────┘
│ longest_streak│  │ │ tags[]       │
│ vibe_score   │   │ │ live_url     │     ┌──────────────┐
│ badge_level  │   │ │ github_url   │     │ social_links │
│ github_user  │   │ │ image_url    │     │──────────────│
│ created_at   │   │ │ build_time   │     │ user_id (FK) │──→ users
└──────────────┘   │ │ verified     │     │ twitter      │
                   │ │ flagged      │     │ telegram     │
                   │ └──────────────┘     │ github       │
                   │                      │ website      │
                   │ ┌──────────────┐     │ farcaster    │
                   │ │hire_requests │     └──────────────┘
                   ├─│──────────────│
                   │ │ id (PK)      │     ┌──────────────┐
                   │ │ builder_id   │←────│hire_messages │
                   │ │ sender_name  │     │──────────────│
                   │ │ sender_email │     │ id (PK)      │
                   │ │ message      │     │hire_request_id│
                   │ │ budget       │     │ sender_type  │
                   │ │ status       │     │ message      │
                   │ │ reply        │     │ created_at   │
                   │ └──────────────┘     └──────────────┘
                   │
                   │ ┌──────────────┐     ┌────────────────┐
                   │ │   reviews    │     │project_reports │
                   ├─│──────────────│     │────────────────│
                     │ id (PK)      │     │ id (PK)        │
                     │ builder_id   │     │ project_id (FK)│──→ projects
                     │ hire_req_id  │     │ reason         │
                     │ reviewer_name│     │ reporter_token │
                     │ rating (1-5) │     │ created_at     │
                     │ comment      │     └────────────────┘
                     └──────────────┘
```

## Tables

### users

The core profile table. Scores and badges are **auto-calculated** by database triggers.

| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Matches Supabase Auth user ID |
| `username` | TEXT (UNIQUE) | Public handle, used in profile URLs |
| `bio` | TEXT | Builder description (max 500 chars) |
| `avatar_url` | TEXT | Profile photo URL |
| `streak` | INTEGER | Current consecutive active days |
| `longest_streak` | INTEGER | All-time best streak |
| `vibe_score` | INTEGER | Composite reputation score |
| `badge_level` | TEXT | `none`, `bronze`, `silver`, `gold`, `diamond` |
| `github_username` | TEXT | Extracted from GitHub OAuth metadata |
| `created_at` | TIMESTAMPTZ | Account creation date |

### projects

Shipped work that proves a builder's capability.

| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Auto-generated |
| `user_id` | UUID (FK → users) | Project owner |
| `title` | TEXT | Project name (max 100 chars) |
| `description` | TEXT | What it does (max 2000 chars) |
| `tech_stack` | TEXT[] | Array of technologies used |
| `tags` | TEXT[] | Categorization tags |
| `live_url` | TEXT | Deployed URL |
| `github_url` | TEXT | Source code URL (must be github.com) |
| `image_url` | TEXT | Screenshot/preview image |
| `build_time` | TEXT | How long it took to build |
| `verified` | BOOLEAN | GitHub ownership verified |
| `flagged` | BOOLEAN | Auto-flagged after 3 reports |
| `created_at` | TIMESTAMPTZ | When the project was added |

### streak_logs

One row per user per day. The `UNIQUE(user_id, activity_date)` constraint prevents duplicate entries.

| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Auto-generated |
| `user_id` | UUID (FK → users) | Who logged the activity |
| `activity_date` | DATE | The day of activity |

**Trigger:** On INSERT, fires `update_user_streak()` to recalculate the user's streak, longest_streak, badge_level, and vibe_score.

### social_links

One row per user (UNIQUE on user_id).

| Column | Type | Description |
|---|---|---|
| `user_id` | UUID (FK → users, UNIQUE) | Builder |
| `twitter` | TEXT | Twitter/X handle |
| `telegram` | TEXT | Telegram username |
| `github` | TEXT | GitHub profile URL |
| `website` | TEXT | Personal website |
| `farcaster` | TEXT | Farcaster handle |

### hire_requests

Client inquiries to builders. No authentication required to submit.

| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Also used as access token for chat |
| `builder_id` | UUID (FK → users) | Target builder |
| `sender_name` | TEXT | Client name |
| `sender_email` | TEXT | Client email (disposable emails blocked) |
| `message` | TEXT | Initial inquiry |
| `budget` | TEXT | Budget range or description |
| `status` | TEXT | `new`, `read`, `replied` |
| `reply` | TEXT | Builder's response |
| `replied_at` | TIMESTAMPTZ | When the builder replied |
| `created_at` | TIMESTAMPTZ | When the request was sent |

### hire_messages

Chat thread for ongoing communication after the initial hire request.

| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Auto-generated |
| `hire_request_id` | UUID (FK → hire_requests) | Parent conversation |
| `sender_type` | TEXT | `builder` or `client` |
| `message` | TEXT | Message content |
| `created_at` | TIMESTAMPTZ | When the message was sent |

### reviews

Public feedback from clients about builders.

| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Auto-generated |
| `builder_id` | UUID (FK → users) | Reviewed builder |
| `hire_request_id` | UUID (FK → hire_requests) | Related engagement |
| `reviewer_name` | TEXT | Client name |
| `reviewer_email` | TEXT | Client email |
| `rating` | INTEGER | 1 to 5 stars |
| `comment` | TEXT | Written feedback |
| `created_at` | TIMESTAMPTZ | When the review was posted |

### project_reports

Spam/abuse reports on projects. Auto-flags after 3 reports.

| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Auto-generated |
| `project_id` | UUID (FK → projects) | Reported project |
| `reason` | TEXT | Why it was reported |
| `reporter_token` | UUID | Unique token to undo the report |
| `created_at` | TIMESTAMPTZ | When the report was filed |

## Database Functions & Triggers

### update_user_streak()

This is the most critical function in the system. It runs automatically when a streak_log is inserted or a project is created/deleted.

**What it calculates:**

```sql
-- 1. Current streak: count consecutive days backwards from today
-- 2. Longest streak: MAX of current and all historical streaks
-- 3. Badge level based on longest_streak:
--    - none:    < 30 days
--    - bronze:  >= 30 days
--    - silver:  >= 90 days
--    - gold:    >= 180 days
--    - diamond: >= 365 days
-- 4. Vibe score formula:
--    (current_streak * 2) + (project_count * 5) + badge_bonus
--    Badge bonuses: bronze=10, silver=20, gold=30, diamond=40
```

**Triggers:**
- `AFTER INSERT ON streak_logs` — Recalculates when user logs activity
- `AFTER INSERT OR DELETE ON projects` — Recalculates when projects change
