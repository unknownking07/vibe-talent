# AI-Powered Matching

VibeTalent includes an AI agent that helps you find the perfect builder for your project. Instead of manually browsing profiles, describe what you need and let the agent do the matching.

## How It Works

1. **Go to `/agent`** — The AI agent's home page
2. **Describe your project** — What you're building, what technologies you need, your timeline
3. **Get recommendations** — The agent analyzes all builders and returns the best matches

## What the Agent Evaluates

The AI agent scores every builder across five dimensions:

| Dimension | What It Measures |
|---|---|
| **Consistency** | Active streak, longest streak, daily activity patterns |
| **Project Quality** | Number of shipped projects, verified projects, live demos |
| **Tech Breadth** | Variety of technologies across their portfolio |
| **Activity Recency** | When they last logged activity — are they active right now? |
| **Reputation** | Vibe Score, badge level, client reviews |

## Agent Features

### Find Builders (`/agent/find`)

Describe your project and the agent suggests matching builders. It considers:
- **Skill overlap** — Does the builder's tech stack match what you need?
- **Availability** — An active streak suggests they're available
- **Track record** — Reviews and completed hire requests
- **Project type fit** — MVPs, full products, bug fixes, or consulting

### Evaluate a Builder (`/agent/evaluate/{username}`)

Get a detailed evaluation report for any builder:

```
┌─────────────────────────────────┐
│ Builder: @alice                 │
│ Overall Score: 87/100           │
├─────────────────────────────────┤
│ Consistency:    ████████░░  85  │
│ Project Quality:█████████░  92  │
│ Tech Breadth:   ███████░░░  75  │
│ Activity:       █████████░  90  │
│ Reputation:     ████████░░  82  │
├─────────────────────────────────┤
│ Strengths:                      │
│ - 90-day active streak          │
│ - 8 shipped projects with demos │
│ - Strong React/TypeScript focus │
│                                 │
│ Considerations:                 │
│ - Limited backend experience    │
│ - No reviews yet                │
└─────────────────────────────────┘
```

This gives you an objective assessment of a builder's capabilities.

### Contact a Builder (`/agent/contact/{username}`)

The agent can help you draft a hire message tailored to the specific builder. It factors in their skills and your project needs to compose a professional outreach message.

### Chat Interface (`/agent/chat`)

A conversational interface where you can ask questions like:
- "Find me a React developer with a 30+ day streak"
- "Who are the top 5 builders for a mobile app project?"
- "Compare @alice and @bob for a TypeScript backend project"

## Tips for Best Results

- **Be specific about your tech stack** — "React, TypeScript, Supabase" gets better matches than "web developer"
- **Mention your project type** — MVP, full product, bug fix, or consultation
- **Include your timeline** — Helps the agent prioritize active builders
- **Describe the problem, not just the solution** — "I need to reduce my app's load time" gives the agent more context to match on

## Public API for AI Agents

If you're building your own AI agent or tool, you can integrate with VibeTalent's public API:

```
GET /api/v1/builders?skills=react,node&min_streak=30&sort=vibe_score
GET /api/v1/builders/{username}
POST /api/v1/hire
GET /api/v1/openapi
```

The OpenAPI spec at `/api/v1/openapi` enables any AI agent to automatically discover and use VibeTalent as a tool.
