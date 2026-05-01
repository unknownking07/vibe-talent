# GitHub Integration

Connecting GitHub does three things for your VibeTalent profile:

1. **Auto-logs your daily streak** — every day you push code, your streak stays alive without you clicking anything.
2. **Powers the contribution heatmap** on your profile — the year-long grid that shows when you're active.
3. **Unlocks the Lifetime + Recent-30d Vibe Score bonuses** (up to **+300 combined**). For builders with years of public commit history, this is often the biggest single component of their score.

## What gets synced

A daily cron at **6 AM UTC** pulls two things from GitHub for every connected user:

### Recent events (last 24 hours)

Used for streak logging and the public activity feed:

| Event | What It Means |
|---|---|
| **PushEvent** | You pushed commits to a repo |
| **CreateEvent** | You created a new repo or branch |
| **PullRequestEvent** | You opened or merged a pull request |
| **IssuesEvent** | You created or worked on an issue |

Stars, watches, and comments don't count — only events that represent real coding.

### Full-year contribution heatmap

Pulled from your public GitHub profile page. We extract:

- **Real per-day commit counts** (e.g. "8 commits on May 4th"), not just whether you were active. This drives the contribution heatmap on your profile and the per-day numbers that show on hover.
- **Lifetime contribution count** (last 365 days) → stored as `lifetime_contributions`, feeds the Vibe Score lifetime bonus on a square-root curve (16k commits → +126 points, capped at +250).
- **Last-30-day contribution count** → stored as `contributions_30d`, feeds the recent activity bonus (up to +50 points).

## How to connect

1. **Sign up with GitHub** — Your username is automatically linked.
2. Or, if you signed up with email: go to your **Dashboard → Settings → Connect GitHub**.
3. The next daily cron run picks you up and populates everything within ~6 hours.

You don't need to push a button to sync — it's automatic once your GitHub username is on file.

## What counts as "activity"

Public commits to public repos. The heatmap only sees what github.com itself shows publicly, so:

- **Commits to private repos** don't count toward `lifetime_contributions` or the heatmap.
- **Commits to forks** don't count unless they're merged upstream (GitHub's rule, not ours).
- **Squashed merge commits** count as one commit on the merge date.
- **Co-authored commits** count for every co-author.

If you do a lot of private work, your VibeTalent score will under-represent your output. The fix today: open-source what you can. The fix tomorrow: we may add a way to log private activity manually for streak purposes (already supported via the Dashboard's "Log Activity" button — but that only credits the streak, not the volume bonus).

## Combining manual + GitHub

You can still log activity manually from the Dashboard for days you worked entirely in private repos. Both contribute to your **streak**. Volume credit (lifetime + 30d) is GitHub-only, since it depends on public, verifiable counts.

## Privacy

- We only read **public** data via the public GitHub API and the public profile page.
- Your GitHub username is stored on your `users` row; we don't store an OAuth token unless you explicitly authenticate via GitHub.
- We never write to your GitHub account.

## Things to know

- The cron has a **5000 req/hour** rate limit on GitHub API calls. If we approach it, the system gracefully degrades — heatmap fetch keeps working (it uses a different rate limit) so volume scoring stays accurate even when the events feed temporarily stops updating.
- If your GitHub username is wrong on your VibeTalent profile, fix it in **Dashboard → Settings** — the next cron run will pick up the corrected handle.
- The volume bonus is **purely additive** — your score can go up when this kicks in, never down.
