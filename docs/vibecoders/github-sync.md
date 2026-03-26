# GitHub Integration

VibeTalent can automatically sync your GitHub activity to log streaks — so you don't have to remember to click "Log Activity" every day.

## What It Does

When you sync your GitHub activity, VibeTalent:
1. Fetches your recent public events from the GitHub API
2. Filters for qualifying coding activity
3. Logs each unique day as a streak entry
4. Triggers a recalculation of your streak, badge, and Vibe Score

## Which Events Count

Not everything on GitHub counts. VibeTalent tracks events that represent real coding work:

| Event | What It Means |
|---|---|
| **PushEvent** | You pushed commits to a repo |
| **CreateEvent** | You created a new repo or branch |
| **PullRequestEvent** | You opened or merged a pull request |
| **IssuesEvent** | You created or worked on an issue |

Other activity (starring repos, watching, commenting) doesn't count — we only track actions that involve writing or shipping code.

## How to Enable It

1. **Sign up with GitHub** — Your GitHub username is automatically linked to your VibeTalent account
2. **Go to your Dashboard**
3. **Click "Sync GitHub Activity"**
4. VibeTalent fetches your recent events and logs any qualifying days

You can trigger a sync manually from your Dashboard whenever you want. The sync looks at your last 24 hours of public GitHub activity.

## Benefits

- **Never miss a day** — If you pushed code on GitHub, your streak is safe
- **No double work** — You're already coding on GitHub; no need to also log manually
- **Automatic** — Just code and push like you normally do

## Things to Know

- Only **public** events are synced (GitHub's API only exposes public activity for users)
- The sync checks the **last 24 hours** of activity per trigger
- If you code in a private repo, you'll need to log manually via the Dashboard
- Your GitHub username is stored securely and only used for API calls

## Combining Manual + GitHub

You can use both methods:
- **GitHub sync** catches your public coding activity
- **Manual logging** covers private repo work, design, planning, or any other coding you do outside GitHub

Both contribute to the same streak. As long as at least one log exists for each day, your streak stays alive.
