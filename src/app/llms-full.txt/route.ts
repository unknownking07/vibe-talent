import { NextResponse } from "next/server";

const LLMS_FULL_TXT = `# VibeTalent — Full Documentation for LLMs

> The marketplace for vibe coders who actually ship.

VibeTalent is a developer talent marketplace that ranks software engineers by coding consistency, shipped projects, and community endorsements rather than traditional resumes. It is built for the new generation of developers who build with AI-powered tools and ship daily.

---

## Platform Overview

VibeTalent solves a fundamental problem in developer hiring: resumes and interviews are unreliable predictors of shipping ability. Instead of asking "Can this person solve a whiteboard puzzle?", VibeTalent asks "Does this person ship code every single day?"

The platform connects two audiences:

- **Developers (Builders)**: Software engineers who want to build a public, verifiable reputation based on real work. They sign up, connect their GitHub account, add projects with live URLs, and let the platform track their daily output.
- **Clients (Hirers)**: Founders, CTOs, and product teams looking to hire developers with proven track records. They browse talent by tech stack, streak length, badge level, and vibe score — or use VibeTalent's AI agent for automated matching.

---

## Key Concepts

### Vibe Coding

Vibe coding is the practice of building software using AI-powered IDEs and coding assistants such as Claude Code, Cursor, Bolt, Windsurf, and similar tools. The term captures a philosophy: stay in flow state, let AI handle boilerplate, focus your energy on architecture and product decisions, and ship every single day.

Vibe coders prioritize:
- **Speed**: Shipping features and fixes quickly, often in hours rather than sprints.
- **Consistency**: Committing code daily, building a streak that proves sustained effort.
- **AI fluency**: Knowing how to prompt, pair-program with, and review AI-generated code effectively.
- **Shipping over planning**: Working software in production beats slide decks and spec documents.

### Vibe Score

The vibe score is VibeTalent's core reputation metric. It is a single number that represents how consistently and effectively a developer ships code. The score is calculated from four weighted components:

1. **Streak Days (40% weight)**: The number of consecutive days a developer has committed code to GitHub. Longer streaks earn exponentially more points.
2. **Project Quality Scores (30% weight)**: Each project receives a quality score based on GitHub repo health metrics — stars, forks, commit frequency, README completeness, and deployment status.
3. **GitHub Activity (20% weight)**: Overall GitHub contribution metrics including commits, pull requests, code reviews, and issue participation.
4. **Peer Endorsements (10% weight)**: Other VibeTalent users can endorse a developer for specific skills. Endorsements from higher-scored developers carry more weight.

### Coding Streaks

A coding streak tracks the number of consecutive days a developer has committed code to at least one GitHub repository. Streaks are the single most important trust signal on VibeTalent.

- VibeTalent syncs with the developer's GitHub profile daily.
- Any commit to any public repository counts toward the streak.
- The streak resets to zero if a full calendar day passes with no commits (UTC).
- Historical streaks are preserved on the profile even after a reset.

### Badge Levels

| Badge    | Requirement      | What It Signals                            |
|----------|-----------------|---------------------------------------------|
| Bronze   | 30-day streak    | Basic consistency and commitment.           |
| Silver   | 90-day streak    | Serious dedication — three months of daily coding. |
| Gold     | 180-day streak   | Elite consistency — half a year of daily work. |
| Diamond  | 365-day streak   | The highest tier — a full year of daily shipping. |

Badges are permanent once earned, even if a streak resets.

---

## How It Works

### For Developers

1. Sign up with your GitHub account.
2. Add projects to your profile (each links to a GitHub repo and optionally a live URL).
3. Build your streak by committing code daily.
4. Earn badges at 30, 90, 180, and 365 consecutive days.
5. Get discovered by clients browsing the explore page, leaderboard, or AI agent.
6. Receive hire requests through the platform.

### For Clients

1. Browse talent on the explore page — filter by language, framework, streak, badge level, and vibe score.
2. Check the leaderboard for top-ranked developers.
3. Use the AI agent to describe your project needs and get matched.
4. Review profiles with streak history, projects, quality scores, and endorsements.
5. Send a hire request directly through the platform.

---

## AI Agent (VibeFinder Bot)

VibeTalent includes an AI-powered agent for talent matching:

- **https://www.vibetalent.work/agent** — Landing page with pre-built queries
- **https://www.vibetalent.work/agent/chat** — Conversational chat interface

The agent searches developers by skill, framework, language, streak, badge, or project type and explains why each match fits.

---

## API

**Base URL**: \`https://www.vibetalent.work/api/v1\`

### GET /api/v1/builders
Search builders by skills, streak, vibe score, badge level. Supports sorting and pagination.

### GET /api/v1/builders/:username
Full builder profile with projects, social links, stats, and endorsements.

### POST /api/v1/hire
Send a hire request to a builder with project description and contact email.

---

## Machine-Readable Resources

- OpenAPI Spec: https://www.vibetalent.work/api/v1/openapi
- AI Plugin Manifest: https://www.vibetalent.work/.well-known/ai-plugin.json
- Agent Skill File: https://www.vibetalent.work/skill.md
- LLMs.txt (summary): https://www.vibetalent.work/llms.txt
- LLMs-full.txt (this file): https://www.vibetalent.work/llms-full.txt

---

## Key URLs

| URL | Purpose |
|-----|---------|
| https://www.vibetalent.work/ | Homepage with overview, stats, and FAQ |
| https://www.vibetalent.work/explore | Browse and filter all developers |
| https://www.vibetalent.work/leaderboard | Top developers by vibe score |
| https://www.vibetalent.work/feed | Live GitHub activity feed |
| https://www.vibetalent.work/agent | AI agent for talent matching |
| https://www.vibetalent.work/agent/chat | Conversational AI agent |

---

## Contact

- Built by @abhiontwt
- Website: https://www.vibetalent.work
- GitHub: https://github.com/unknownking07/vibe-talent
`;

export async function GET() {
  return new NextResponse(LLMS_FULL_TXT, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
