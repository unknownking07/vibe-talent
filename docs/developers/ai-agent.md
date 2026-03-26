# AI Agent

VibeTalent includes an experimental AI agent system that intelligently matches vibecoders to client needs and provides structured evaluation reports.

## Overview

The AI agent lives at `/agent/*` and provides three core capabilities:

1. **VibeCoder Evaluation** — Score and analyze individual vibecoders
2. **VibeCoder Matching** — Find the best vibecoders for a specific job
3. **Message Generation** — Auto-compose hire messages

## Agent Scoring System

### Evaluation Criteria

The agent evaluates vibecoders across five dimensions:

| Dimension | Weight | What It Measures |
|---|---|---|
| **Consistency** | High | Current streak, longest streak, daily activity pattern |
| **Project Quality** | High | Number of shipped projects, descriptions, live demos |
| **Tech Breadth** | Medium | Variety of technologies across projects |
| **Activity Recency** | Medium | How recent is their last activity |
| **Reputation** | Medium | Badge level, vibe score, reviews |

### Scoring Algorithm

```
For each vibecoder:
  1. Normalize each dimension to 0-100
  2. Apply weighted scoring:
     - Consistency: streak length, regularity
     - Project quality: count, completeness (URLs, descriptions)
     - Tech breadth: unique technologies across projects
     - Recency: time since last streak log
     - Reputation: vibe_score + badge + review average
  3. Combine into composite score
  4. Rank against other candidates
```

### Evaluation Report

The agent generates a structured report for each vibecoder:

```
┌─────────────────────────────────┐
│ VibeCoder: @alice               │
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

## VibeCoder Matching

### How Matching Works

When a client describes their project needs, the agent:

1. **Parses requirements** — Extracts tech stack, timeline, and budget signals
2. **Queries vibecoders** — Filters by relevant skills
3. **Scores candidates** — Evaluates each against the five dimensions
4. **Ranks results** — Returns top matches with explanations

### Match Factors

| Factor | How It's Used |
|---|---|
| **Skill overlap** | VibeCoder's tech_stack vs. required technologies |
| **Availability signal** | Active streak suggests availability |
| **Budget alignment** | Past project complexity vs. stated budget |
| **Track record** | Reviews and completed hire requests |

## Agent Pages

### `/agent` — Main Interface

Entry point with options to find, evaluate, or contact vibecoders.

### `/agent/find` — Find VibeCoders

Describe your project and the agent suggests matching vibecoders.

### `/agent/evaluate/{username}` — Evaluate VibeCoder

Get a detailed evaluation report for a specific vibecoder.

### `/agent/contact/{username}` — Contact VibeCoder

AI-assisted message generation for hire requests.

### `/agent/chat` — Chat Interface

Conversational interface for natural language vibecoder search.

## Agent Components

| Component | Purpose |
|---|---|
| `AgentThinking` | Loading animation while agent processes |
| `ChatInput` | Text input for conversational interface |
| `ChatMessage` | Renders agent responses with formatting |
| `EvaluationReport` | Visual vibecoder evaluation display |
| `MatchCard` | VibeCoder match result card |

## Public API for Agents

External AI agents can integrate with VibeTalent through the v1 API:

```
# Search vibecoders by skills
GET /api/v1/builders?skills=react,node&min_streak=30&sort=vibe_score

# Get full profile
GET /api/v1/builders/alice

# Submit hire request
POST /api/v1/hire
{
  "username": "alice",
  "sender_name": "AI Recruiter",
  "sender_email": "recruiter@company.com",
  "message": "...",
  "budget": "..."
}

# OpenAPI spec for tool registration
GET /api/v1/openapi
```

The OpenAPI spec at `/api/v1/openapi` enables AI agents to automatically discover and use VibeTalent's API as a tool.
