# Core Features

## Vibe Score

The **Vibe Score** is the single number that represents a builder's reputation. It's designed to be unfakeable — you can't buy it, you can only earn it through consistent work.

### Formula

```
vibe_score = (current_streak × 2) + (project_count × 5) + badge_bonus
```

| Component | Multiplier | Why |
|---|---|---|
| Current Streak | ×2 per day | Rewards active, consistent builders |
| Project Count | ×5 per project | Rewards shipped work |
| Badge Bonus | +10 to +40 | Rewards long-term dedication |

**Badge Bonuses:**

| Badge | Bonus |
|---|---|
| Bronze | +10 |
| Silver | +20 |
| Gold | +30 |
| Diamond | +40 |

### Example Calculations

| Builder | Streak | Projects | Badge | Vibe Score |
|---|---|---|---|---|
| Beginner | 5 days | 1 project | none | (5×2) + (1×5) + 0 = **15** |
| Active | 45 days | 3 projects | bronze | (45×2) + (3×5) + 10 = **115** |
| Veteran | 180 days | 10 projects | gold | (180×2) + (10×5) + 30 = **440** |

### Auto-Calculation

The Vibe Score is **never manually set**. It's recalculated automatically by the `update_user_streak()` database function whenever:

- A streak log is inserted (daily activity)
- A project is created or deleted

---

## Streak System

Streaks track consecutive days of coding activity. They are the foundation of VibeTalent's reputation system.

### How Streaks Work

1. **Log activity** — Call `POST /api/streak` (or sync from GitHub)
2. **One entry per day** — The `UNIQUE(user_id, activity_date)` constraint prevents duplicates
3. **Consecutive counting** — The database function counts backwards from today
4. **Break = reset** — Miss a day and your current streak goes to 0
5. **Longest preserved** — Your best streak is saved forever (for badge qualification)

### Streak Calculation Logic

```
Starting from today, count backwards:
  - If today has a log → streak starts at 1
  - If yesterday has a log → streak = 2
  - Continue until a gap is found
  - The gap breaks the streak
```

### Daily Reset Cron

A Vercel Cron job runs daily at 00:00 UTC:

```
/api/cron/reset-streaks
  → Find users with streak > 0
  → Check if they have a streak_log for yesterday
  → If not → reset streak to 0
  → Recalculate vibe_score
```

### GitHub Auto-Sync

Builders can sync their GitHub activity to automatically log streaks:

```
POST /api/github/activity
  → Fetch recent public events from GitHub API
  → Filter: PushEvent, CreateEvent, PullRequestEvent, IssuesEvent
  → Insert into streak_logs (one per unique day)
  → Trigger recalculates streak
```

This means active GitHub users don't need to manually log — their coding activity counts automatically.

---

## Badge System

Badges are earned through sustained streaks and can never be lost. They provide a visual trust signal on profiles.

### Badge Tiers

| Badge | Requirement | Vibe Score Bonus | Visual |
|---|---|---|---|
| **None** | < 30 day streak | +0 | No badge |
| **Bronze** | 30+ day streak | +10 | Bronze shield |
| **Silver** | 90+ day streak | +20 | Silver shield |
| **Gold** | 180+ day streak | +30 | Gold shield |
| **Diamond** | 365+ day streak | +40 | Diamond shield |

### Key Rules

- Badges are based on **longest_streak**, not current streak
- Once earned, a badge is **permanent** — even if your current streak resets
- Badge level is recalculated on every streak update
- Badges display on profile cards, leaderboard, and explore page

### Badge Progression Example

```
Day 1-29:   No badge, building streak
Day 30:     🥉 Bronze earned! (+10 vibe bonus)
Day 31-89:  Still bronze, streak growing
Day 90:     🥈 Silver earned! (+20 vibe bonus, replaces +10)
Day 91-179: Silver badge, streak continues
Day 180:    🥇 Gold earned! (+30 vibe bonus)
Day 200:    Streak breaks (missed a day)
            → Current streak resets to 0
            → Badge stays Gold (based on longest_streak = 200)
            → Vibe score drops but gold bonus remains
```

---

## Project Showcase

Projects are the tangible proof of what a builder can do.

### Creating a Project

Builders add projects from the dashboard with:

| Field | Required | Validation |
|---|---|---|
| Title | Yes | Max 100 characters |
| Description | Yes | Max 2000 characters |
| Tech Stack | Yes | Array of technology names |
| Tags | No | Categorization tags |
| Live URL | No | Must be HTTP/HTTPS |
| GitHub URL | No | Must be github.com domain |
| Image | No | Uploaded to Supabase Storage |
| Build Time | No | How long it took |

### Project Verification

Projects with a GitHub URL can be verified for ownership (verification system exists but is not fully automated yet).

### Spam Protection

The community can report projects:

1. Anyone can report a project with a reason
2. Reporter gets a `reporter_token` (UUID) to undo their report
3. After **3 reports**, the project is **automatically flagged**
4. Flagged projects are hidden from public listings
5. Rate limit: 10 reports per hour per IP

---

## Activity Heatmap

Each builder's profile includes a GitHub-style activity heatmap showing their coding activity over the past year.

The heatmap visualizes data from `streak_logs`, showing:
- **Green cells** for active days (intensity based on activity)
- **Empty cells** for inactive days
- **Streak highlights** for consecutive active periods

This gives clients an instant visual of a builder's consistency.
