// Platform knowledge injected into the VibeFinder assistant's system prompt.
//
// This is the bot's single source of truth for how VibeTalent works. Keep it
// in sync with the product — if a fact isn't here (and isn't in live tool
// data), the bot is instructed to say it doesn't know and point the user to
// human support rather than guess.

export const SUPPORT_EMAIL = "vibetalentwork@gmail.com";

export const PLATFORM_FACTS = `## Vibe Score
Vibe score is a public reputation score: baseline 10 + the strongest public verified project's evidence (0–100) + endorsements + trusted reviews + existing vouch credit. Commits, contribution totals, streaks, badges, popularity and project count add zero points. Project evidence checks ownership, README, test-related files/config, CI/container config and live URL reachability; they do not establish passing tests or client delivery.

## Coding Streaks
- Consecutive days of recorded activity, including GitHub sync and manual check-ins.
- A streak does not prove meaningful code changes or a shipped product.
- Public GitHub activity is synced daily. Private activity sharing is optional; VibeTalent does not read private repository source code.
- Longest/historical streaks are preserved after a reset.

## Hiring evidence
- The default founder match ranks skills and tags listed on public, ownership-verified projects alongside inspectable repository signals. Skills and tags are builder-provided, not independently assessed.
- Streaks, badges, vibe score, raw commit counts, repository popularity, project volume, endorsements, and reviews do not add points to the hiring evaluation.
- The portfolio evidence score uses the strongest public ownership-verified project: ownership 40, README detected 15, test-related files/configuration detected 15, CI/container configuration detected 10, and a live URL reachable at its last check 20.
- Ownership verification does not establish original authorship, working functionality, security, or delivery quality. Test-related flags can mean test configuration only; CI flags can mean container files only. Neither proves passing tests or successful runs.
- Hire replies establish conversations only. There is no verified completed-hire count, completion rate, or repeat-paying-client metric yet. Review trust scores are abuse heuristics, not proof of delivery.
- Founders should inspect the linked source/demo, request a walkthrough, and agree a small paid trial with scope and acceptance criteria directly with the builder. VibeTalent does not currently manage trial funding, acceptance, or payouts.

## Badges (permanent once earned)
- Bronze: 30-day streak
- Silver: 90-day streak
- Gold: 180-day streak
- Diamond: 365-day streak

## Projects
- Add projects from your dashboard/profile using the "Add Project" flow. Each links to a GitHub repo (and optionally a live URL).
- Projects are automatically verified and quality-scored against GitHub when you add them. This is the only way to add a project so it gets scored.

## GitHub connection
- VibeTalent connects to GitHub with public read-only access only. It never asks for private-repo permissions. So only public activity is visible and counted.

## Hiring
- Hiring is direct and completely free. There are no platform fees and no middleman.
- Open any builder's profile, click "Hire", and message them directly.
- Clients can also chat with VibeFinder (at /agent/chat) to describe a project and get matched with builders.

## Endorsements & Reviews
- Users can endorse projects. Endorsements reflect community feedback, not verified client delivery.
- Builders can receive reviews on their profile.

## Pricing
- VibeTalent is free for developers: profiles, GitHub connection, streaks, badges, projects, and getting hired all cost nothing.
- The only optional paid feature is Featured Projects/promotions: paying to feature a project for extra visibility. It is purely optional and does NOT affect vibe score, badges, or ranking. Featured promotions are paid in USDC (crypto).

## Key pages
- /explore: browse and filter all builders (by language, framework, streak, badge, vibe score)
- /leaderboard: rankings by project evidence and community reputation
- /feed: live GitHub activity feed
- /agent and /agent/chat: VibeFinder, the AI assistant for talent matching and platform help
- /dashboard. Your own profile, streak, and projects`;
