// Platform knowledge injected into the VibeFinder assistant's system prompt.
//
// This is the bot's single source of truth for how VibeTalent works. Keep it
// in sync with the product — if a fact isn't here (and isn't in live tool
// data), the bot is instructed to say it doesn't know and point the user to
// human support rather than guess.

export const SUPPORT_EMAIL = "vibetalentwork@gmail.com";

export const PLATFORM_FACTS = `## Vibe Score
The core reputation metric — one number for how consistently and effectively a developer ships. It is calculated from four weighted components:
- Streak Days — 40%
- Project Quality — 30% (GitHub repo health: stars, forks, commit frequency, README, deployment status)
- GitHub Activity — 20% (commits, pull requests, code reviews, issues)
- Peer Endorsements — 10% (endorsements from higher-scored developers count for more)
It updates daily and is based entirely on public, verifiable data. It cannot be gamed with fake reviews or purchased followers.

## Coding Streaks
- A streak = consecutive days with at least one commit to any PUBLIC GitHub repo.
- Synced from GitHub daily.
- Resets to zero if a full calendar day (UTC) passes with no commits.
- Your longest/historical streak is preserved on your profile even after a reset.
- Commits to private repos do NOT count — VibeTalent only reads public GitHub activity.

## Badges (permanent once earned)
- Bronze — 30-day streak
- Silver — 90-day streak
- Gold — 180-day streak
- Diamond — 365-day streak

## Projects
- Add projects from your dashboard/profile using the "Add Project" flow — each links to a GitHub repo (and optionally a live URL).
- Projects are automatically verified and quality-scored against GitHub when you add them. This is the only way to add a project so it gets scored.

## GitHub connection
- VibeTalent connects to GitHub with public read-only access only. It never asks for private-repo permissions. So only public activity is visible and counted.

## Hiring
- Hiring is direct and completely free — there are no platform fees and no middleman.
- Open any builder's profile, click "Hire", and message them directly.
- Clients can also chat with VibeFinder (at /agent/chat) to describe a project and get matched with builders.

## Endorsements & Reviews
- Users can endorse other builders for specific skills; endorsements from higher-scored developers carry more weight.
- Builders can receive reviews on their profile.

## Pricing
- VibeTalent is free for developers: profiles, GitHub connection, streaks, badges, projects, and getting hired all cost nothing.
- The only optional paid feature is Featured Projects/promotions — paying to feature a project for extra visibility. It is purely optional and does NOT affect vibe score, badges, or ranking. Featured promotions are paid in USDC (crypto).

## Key pages
- /explore — browse and filter all builders (by language, framework, streak, badge, vibe score)
- /leaderboard — top builders by vibe score
- /feed — live GitHub activity feed
- /agent and /agent/chat — VibeFinder, the AI assistant for talent matching and platform help
- /dashboard — your own profile, streak, and projects`;
