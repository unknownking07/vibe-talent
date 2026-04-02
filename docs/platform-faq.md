# Vibe Talent Platform FAQ

## How does Vibe Talent connect to GitHub and other platforms for the heatmap?

### GitHub Integration

Vibe Talent connects to GitHub through two mechanisms:

1. **OAuth Authentication**: When users sign up with GitHub, the platform extracts their GitHub username from OAuth metadata and stores it for future API calls.

2. **Two data sources power the heatmap:**
   - **GitHub Contributions Calendar**: Fetched by scraping `github.com/users/{username}/contributions` (the same contribution graph on your GitHub profile). This data is cached for 1 hour.
   - **Internal Streak Logs**: Activity records from automated GitHub event syncing and manual activity logging. When streak logs have a higher activity level than GitHub data for a given day, the streak log value takes precedence.

3. **GitHub Activity Sync**: A cron job runs every 6 hours, fetching public GitHub events via the GitHub API. It tracks qualifying events:
   - `PushEvent` (commits pushed)
   - `CreateEvent` (repos/branches created)
   - `PullRequestEvent` (PRs opened/merged)
   - `IssuesEvent` (issues created/worked on)

### Other Platforms

Currently, only **GitHub** is integrated for automatic activity tracking. Users can store social links for Twitter/X, Telegram, Farcaster, and personal websites, but these are not synced for activity data. GitLab, Bitbucket, and other Git hosting platforms are not yet integrated for contribution tracking.

### Key Files

- GitHub contributions API: `src/app/api/github/contributions/route.ts`
- GitHub activity sync API: `src/app/api/github/activity/route.ts`
- Automated sync cron job: `src/app/api/cron/github-sync/route.ts`
- Heatmap component: `src/components/profile/profile-heatmap.tsx`

---

## What happens after users sign up and optimize their profile?

### Post-Signup Onboarding (4 Steps)

1. **Profile Basics** — Set username, bio, and avatar (pulled from OAuth provider)
2. **Social Links** — GitHub username (required) + at least one of Twitter/Telegram (required)
3. **First Project** — Optionally showcase a project with GitHub repo URL
4. **First Streak** — Log your first activity day and process any referral bonuses

### Ongoing Profile Optimization

After onboarding, the platform continuously tracks and updates:

- **Vibe Score**: Calculated as `(current_streak × 2) + verified_project_quality_points + badge_bonuses`
- **Badge Progression**: None → Bronze (30 days) → Silver (90) → Gold (180) → Diamond (365 days)
- **Project Verification**: Users can verify ownership of GitHub repos. Verified projects undergo quality analysis (stars, forks, tests, CI/CD, commit frequency) producing a quality score (0-100)
- **Streak Freezes**: 2 per month to protect streaks during breaks (reset on the 1st of each month)
- **Profile Views**: Tracked with daily and weekly email digests
- **Hire Requests**: Clients can send work inquiries with budget information
- **Leaderboard**: Users are ranked by vibe score

### User Count

The admin stats endpoint (`/api/admin-stats`) returns the current total number of builders (users), along with metrics like average streak, badge distribution, and weekly growth. This data is dynamic from the database.

---

## Do I have to resync my data every time for it to reflect on Vibe Talent?

**No — syncing is fully automatic.**

| Sync Method | Frequency | User Action Required |
|-------------|-----------|---------------------|
| Automated cron job | Every 6 hours | None |
| Manual sync button | On-demand | Click "Sync GitHub Activity" on dashboard |
| Heatmap data refresh | Every page visit | None (auto-fetches, cached 1 hour) |

### How Automatic Sync Works

1. The cron job at `/api/cron/github-sync` runs every 6 hours
2. It fetches the last 24 hours of public GitHub events for all users
3. Qualifying events are logged into `streak_logs` (one entry per active day)
4. Recent events are saved to `feed_events` for the activity feed
5. Streak count and longest streak are recalculated automatically
6. Vibe score and badge level update via database triggers

### Important Note

Only **public** GitHub events are tracked, since the platform uses the public GitHub API without personal access tokens. Activity in private repositories will not appear on the heatmap or affect streak calculations.

### Additional Automated Jobs

| Job | Schedule | Purpose |
|-----|----------|---------|
| Streak reset | Daily at midnight UTC | Resets inactive streaks (or consumes a freeze) |
| Streak warning | Daily at 6 PM UTC | Warns users whose streaks expire at midnight |
| Milestone check | Daily | Notifies users hitting vibe score milestones (25, 50, 100, 200, 500, 1000) |
| Freeze reset | Monthly (1st) | Resets streak freeze allowance to 2 |
| Weekly digest | Mondays | Sends recap of views, streak, and vibe score |
