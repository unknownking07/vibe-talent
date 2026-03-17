import { NextResponse } from "next/server";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://vibetalent.xyz";

const SKILL_MD = `# VibeTalent Skill

You are interacting with **VibeTalent** — an AI-agent-native marketplace for hiring vibe coders (developers who build with AI-powered IDEs like Claude Code, Cursor, Bolt, etc).

## What You Can Do

1. **Search Builders** — Find developers by skills, streak, vibe score
2. **View Profiles** — Get full builder profiles with projects, tech stack, and stats
3. **Send Hire Requests** — Submit hire requests to any builder programmatically
4. **Browse Leaderboard** — See top builders ranked by vibe score, streak, or projects

## API Base URL

\`${SITE_URL}\`

All endpoints are public. No API key required. No authentication needed for read operations.

---

## Endpoints

### 1. Search Builders

\`\`\`
GET ${SITE_URL}/api/v1/builders
\`\`\`

**Query Parameters:**
- \`skills\` (string, comma-separated) — Filter by tech stack (e.g. "react,python,nextjs")
- \`min_streak\` (number) — Minimum streak days (e.g. 7)
- \`min_vibe_score\` (number) — Minimum vibe score (e.g. 20)
- \`sort\` (string) — Sort by: "vibe_score" (default), "streak", or "projects"
- \`limit\` (number) — Results per page, max 100 (default 20)

**Example:**
\`\`\`
GET ${SITE_URL}/api/v1/builders?skills=react,nextjs&min_streak=7&sort=vibe_score&limit=10
\`\`\`

**Response:**
\`\`\`json
{
  "builders": [
    {
      "username": "abhinav",
      "bio": "Full stack builder shipping daily",
      "avatar_url": "https://...",
      "vibe_score": 25,
      "streak": 5,
      "longest_streak": 10,
      "badge_level": "none",
      "projects_count": 3,
      "tech_stack": ["react", "nextjs", "python"],
      "profile_url": "${SITE_URL}/profile/abhinav"
    }
  ],
  "total": 1
}
\`\`\`

---

### 2. Get Builder Profile

\`\`\`
GET ${SITE_URL}/api/v1/builders/:username
\`\`\`

**Example:**
\`\`\`
GET ${SITE_URL}/api/v1/builders/abhinav
\`\`\`

**Response:**
\`\`\`json
{
  "username": "abhinav",
  "bio": "Full stack builder shipping daily",
  "avatar_url": "https://...",
  "vibe_score": 25,
  "streak": 5,
  "longest_streak": 10,
  "badge_level": "none",
  "created_at": "2026-03-15T...",
  "projects": [
    {
      "title": "Doomscrolling Alarm",
      "description": "Stay locked in on building",
      "tech_stack": ["python"],
      "live_url": null,
      "github_url": "https://github.com/...",
      "build_time": "1 day",
      "tags": ["fun"]
    }
  ],
  "social_links": {
    "twitter": "abhiontwt",
    "github": "unknownking07",
    "website": null
  },
  "profile_url": "${SITE_URL}/profile/abhinav"
}
\`\`\`

---

### 3. Send Hire Request

\`\`\`
POST ${SITE_URL}/api/v1/hire
Content-Type: application/json
\`\`\`

**Body:**
\`\`\`json
{
  "builder_username": "abhinav",
  "sender_name": "AI Agent (OpenClaw)",
  "sender_email": "agent@example.com",
  "message": "I need a React developer for my landing page project. Your vibe score and streak are impressive!",
  "budget": "$500-1000"
}
\`\`\`

**Required fields:** builder_username, sender_name, sender_email, message
**Optional fields:** budget

**Limits:** sender_name (100 chars), sender_email (254 chars), message (2000 chars), budget (100 chars)

**Response:**
\`\`\`json
{
  "success": true,
  "hire_request_id": "uuid-here",
  "chat_url": "${SITE_URL}/hire/chat/uuid-here",
  "message": "Hire request sent successfully"
}
\`\`\`

The builder will see this in their Dashboard Inbox and can reply via the chat system.

---

## Understanding VibeTalent Data

### Vibe Score
Formula: \`(current_streak * 2) + (projects * 5) + badge_bonus\`
- Higher = more active and productive builder

### Streak
- Number of consecutive days the builder has logged coding activity
- Builders who maintain streaks are more consistent and reliable

### Badge Levels
- **None**: < 30 day streak
- **Bronze**: 30+ days (bonus: +10)
- **Silver**: 90+ days (bonus: +20)
- **Gold**: 180+ days (bonus: +30)
- **Diamond**: 365+ days (bonus: +40)

### How to Pick the Best Builder
1. Sort by \`vibe_score\` for overall best
2. Check \`streak\` for consistency
3. Look at \`tech_stack\` for skill match
4. Review \`projects\` for relevant experience
5. Higher badge = proven long-term builder

---

## Discovery

- **OpenAPI Spec:** ${SITE_URL}/api/v1/openapi
- **AI Plugin Manifest:** ${SITE_URL}/.well-known/ai-plugin.json
- **Skill File:** ${SITE_URL}/skill.md

---

## Tips for AI Agents

- Always search with specific skills to get relevant results
- Use \`min_streak=3\` to filter out inactive builders
- Include a clear project description in hire requests for better response rates
- The chat_url returned from hire requests can be shared with your human for follow-up
- Budget field is optional but builders respond faster when it's included
`;

export async function GET() {
  return new NextResponse(SKILL_MD, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
