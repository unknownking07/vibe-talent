import { NextResponse } from "next/server";
import { getSiteUrl } from "@/lib/seo";

const SITE_URL = getSiteUrl();

const SKILL_MD = `# VibeTalent Skill

You are interacting with **VibeTalent**: an AI-agent-native marketplace for hiring vibe coders (developers who build with AI-powered IDEs like Claude Code, Cursor, Bolt, etc).

## What You Can Do

1. **Search Builders**: Find developers by skills and inspect verified project evidence
2. **View Profiles**: Get full builder profiles with projects, tech stack, and stats
3. **Send Hire Requests**: Submit hire requests to any builder programmatically
4. **Browse Leaderboard**: Browse reputation rankings; activity statistics are descriptive

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
- \`skills\` (string, comma-separated): Filter by tech stack (e.g. "react,python,nextjs")
- \`min_streak\` (number): Minimum streak days (e.g. 7)
- \`min_vibe_score\` (number): Minimum vibe score (e.g. 20)
- \`verified_only\` (boolean): If \`true\`, return only builders with at least one GitHub-verified project. Recommended for hire decisions.
- \`sort\` (string): Sort by: "vibe_score" (default), "streak", or "projects"
- \`limit\` (number): Results per page, max 100 (default 20)

**Example:**
\`\`\`
GET ${SITE_URL}/api/v1/builders?skills=react,nextjs&verified_only=true&sort=vibe_score&limit=10
\`\`\`

**Response:**
\`\`\`json
{
  "builders": [
    {
      "username": "abhinav",
      "profile_url": "${SITE_URL}/profile/abhinav",
      "bio": "Full stack builder shipping daily",
      "avatar_url": "https://...",
      "vibe_score": 25,
      "streak": 5,
      "longest_streak": 10,
      "badge_level": "none",
      "projects_count": 3,
      "verified_projects_count": 2,
      "tech_stack": ["react", "nextjs", "python"]
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
  "builder": {
    "username": "abhinav",
    "profile_url": "${SITE_URL}/profile/abhinav",
    "bio": "Full stack builder shipping daily",
    "avatar_url": "https://...",
    "vibe_score": 25,
    "streak": 5,
    "longest_streak": 10,
    "badge_level": "none",
    "created_at": "2026-03-15T...",
    "review_count": 2,
    "average_rating": 4.5,
    "projects": [
      {
        "id": "uuid-here",
        "title": "Doomscrolling Alarm",
        "description": "Stay locked in on building",
        "tech_stack": ["python"],
        "live_url": "https://example.com",
        "github_url": "https://github.com/owner/repo",
        "build_time": "1 day",
        "tags": ["fun"],
        "verified": true,
        "quality_score": 100,
        "quality_metrics": {
          "stars": 14, "forks": 2, "contributors": 1, "total_commits": 42,
          "has_tests": true, "has_ci": true, "has_readme": true,
          "community_score": 0, "substance_score": 100, "maintenance_score": 0
        },
        "live_url_ok": true,
        "endorsement_count": 3,
        "created_at": "2026-03-20T..."
      }
    ],
    "social_links": {
      "twitter": "abhiontwt",
      "github": "unknownking07",
      "website": null
    }
  }
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
  "message": "I need a React developer for my landing page project. Your verified React project looks relevant. Could we discuss a paid trial with clear acceptance criteria?",
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
A reputation summary: baseline 10 + strongest public verified project evidence + trusted review, endorsement, and vouch credit.
Commit counts, streaks, badges, popularity, and adding more projects earn no reputation points. A score is not proof of delivery or a hiring guarantee.

### Streak
- Number of consecutive days the builder has logged coding activity
- Activity context only; it does not establish reliability, skill, or delivery

### Badge Levels
- **None**: < 30 day streak
- **Bronze**: 30+ days
- **Silver**: 90+ days
- **Gold**: 180+ days
- **Diamond**: 365+ days

### Project Verification (\`verified\`)
A project is \`verified: true\` when its GitHub repo ownership is proven: either the
repo owner's immutable GitHub ID matches the builder's authenticated GitHub identity,
or a \`.vibetalent\` file contains the builder's exact VibeTalent account UUID on its own line. **Strongly prefer verified
projects** when evaluating builders: unverified projects are unproven claims.

### Quality Score (\`quality_score\`, 0-100)
Repository file checks: README presence (30), test-related files (40), and CI/container configuration (30).
These checks do not run tests, inspect implementation quality, or prove delivery.
Commits, stars, forks, and recency earn no points.

\`quality_metrics\` exposes the raw signals (stars, forks, contributors,
total_commits, has_tests, has_ci, has_readme, plus sub-scores) so agents can
inspect the evidence. Activity and popularity must not be treated as delivery proof.

### Live URL Health (\`live_url_ok\`)
\`true\` if the project's \`live_url\` responded healthily on the most recent check.
\`false\` means the deployment is broken or unreachable. \`null\` means either no
\`live_url\` is set or the first health check hasn't run yet: treat null as
"unknown" rather than "healthy" or "broken".

### Endorsements (\`endorsement_count\`)
Peer endorsements from other builders on the platform. Social-proof signal.

### Reviews (\`review_count\`, \`average_rating\`)
Reviews are filtered by an anti-abuse trust score before averaging, only
\`trust_score >= 30\` reviews count. \`average_rating\` is null when the builder
has no trusted reviews.

### How to Pick the Best Builder
1. Filter with \`verified_only=true\` to skip unverified claims
2. Match listed \`tech_stack\` and project scope to the task; listed skills are self-reported
3. Pull the full profile, inspect verified repositories, and try their live demos
4. Read trusted reviews and endorsements as supporting context
5. Agree on a small paid trial, budget, deadline, and observable acceptance criteria
6. Judge the delivered result and communication; streaks and badges are not hiring evidence

---

## Discovery

- **OpenAPI Spec:** ${SITE_URL}/api/v1/openapi
- **AI Plugin Manifest:** ${SITE_URL}/.well-known/ai-plugin.json
- **Skill File:** ${SITE_URL}/skill.md

---

## Tips for AI Agents

- Always search with specific skills to get relevant results
- Pass \`verified_only=true\` to skip builders whose project ownership is unproven
- Do not use streaks, commit totals, or badge levels as talent or reliability filters
- Pull the full profile (\`/builders/:username\`) before deciding: \`projects_count\` and
  \`tech_stack\` summary aren't enough; check each project's \`verified\`, \`quality_score\`,
  and \`live_url_ok\`
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
