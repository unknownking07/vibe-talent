import { NextResponse } from "next/server";

const LLMS_TXT = `# VibeTalent

> The marketplace for vibe coders who actually ship.

VibeTalent is a developer talent marketplace that ranks software engineers by coding consistency, shipped projects, and community endorsements rather than traditional resumes.

## Key Concepts

- **Vibe Coding**: Building software using AI-powered IDEs (Claude Code, Cursor, Bolt, etc.) with a focus on shipping fast and consistently.
- **Vibe Score**: A reputation metric calculated from a developer's streak, project quality, GitHub activity, and peer endorsements.
- **Streaks**: Consecutive days a developer has committed code. Streaks are the core trust signal on VibeTalent.
- **Badge Levels**: Bronze (30-day streak), Silver (90-day), Gold (180-day), Diamond (365-day).
- **Quality Score**: A per-project metric based on GitHub repo health — community engagement, code substance, and maintenance activity.

## How It Works

1. Developers sign up and connect their GitHub profiles.
2. They add projects with live URLs that get verified.
3. The platform tracks their daily coding streak and calculates a vibe score.
4. Clients browse builders by tech stack, badge level, and streak — or use the AI agent to get matched automatically.

## Key Pages

- Homepage: https://www.vibetalent.work/
- Explore Talent: https://www.vibetalent.work/explore
- Leaderboard: https://www.vibetalent.work/leaderboard
- AI Agent (find talent): https://www.vibetalent.work/agent
- AI Agent (chat): https://www.vibetalent.work/agent/chat

## Who Uses VibeTalent

- **Developers** who want to build a reputation based on proof of work rather than resumes.
- **Clients and founders** looking to hire developers with verified track records of consistent shipping.

## Machine-Readable Resources

- OpenAPI Spec: https://www.vibetalent.work/api/v1/openapi
- AI Plugin Manifest: https://www.vibetalent.work/.well-known/ai-plugin.json
- Agent Skill File: https://www.vibetalent.work/skill.md
- Extended Docs: https://www.vibetalent.work/llms-full.txt

## API Endpoints

- GET /api/v1/builders — Search builders by skills, streak, vibe score
- GET /api/v1/builders/:username — Full builder profile with projects and stats
- POST /api/v1/hire — Send a hire request to any builder

## Contact

- Built by @abhiontwt
- Website: https://www.vibetalent.work
- GitHub: https://github.com/unknownking07/vibe-talent
`;

export async function GET() {
  return new NextResponse(LLMS_TXT, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
