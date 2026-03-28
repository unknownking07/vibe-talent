# API Reference

VibeTalent exposes two sets of APIs:

1. **Public API (v1)** — Versioned, CORS-enabled, designed for external integrations and AI agents
2. **Internal API** — Used by the frontend, some endpoints require authentication

## Public API (v1)

Base URL: `https://vibetalent.work/api/v1`

All v1 endpoints include CORS headers and return JSON. No authentication required.

### List VibeCoders

```
GET /api/v1/builders
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `skills` | string | — | Comma-separated tech stack filter (e.g., `react,typescript`) |
| `min_streak` | number | — | Minimum current streak |
| `sort` | string | `vibe_score` | Sort by: `vibe_score`, `streak`, `projects` |
| `limit` | number | `20` | Max results (1-100) |
| `offset` | number | `0` | Pagination offset |

**Response:**

```json
{
  "builders": [
    {
      "username": "alice",
      "bio": "Full-stack vibecoder",
      "avatar_url": "https://...",
      "streak": 45,
      "vibe_score": 120,
      "badge_level": "silver",
      "projects": [
        {
          "title": "My App",
          "tech_stack": ["react", "typescript"],
          "live_url": "https://myapp.com"
        }
      ]
    }
  ],
  "total": 150,
  "limit": 20,
  "offset": 0
}
```

### Get VibeCoder Profile

```
GET /api/v1/builders/{username}
```

Returns the full profile including projects, social links, and reviews.

### Submit Hire Request

```
POST /api/v1/hire
```

**Body:**

```json
{
  "username": "alice",
  "sender_name": "Bob Smith",
  "sender_email": "bob@company.com",
  "message": "I'd like to hire you for a React project",
  "budget": "$5,000 - $10,000"
}
```

**Validation:**
- `sender_email` is checked against the disposable email blocklist
- All fields are required and trimmed

### OpenAPI Specification

```
GET /api/v1/openapi
```

Returns the full OpenAPI 3.0 JSON spec. Useful for AI agent tool registration.

---

## Internal API

### Leaderboard

```
GET /api/leaderboard
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `sort` | string | `vibe_score` | `vibe_score`, `streak`, or `projects` |
| `limit` | number | `10` | Max results |

### Projects

```
GET /api/projects
```

Returns all non-flagged projects with user data.

### Streak

```
GET /api/streak?user_id={uuid}
```

Returns calculated streak data for a user.

```
POST /api/streak
```

**Requires authentication.** Logs activity for the current day. Returns updated user data.

**Rate limit:** 60 requests/minute per IP.

### Users

```
GET /api/users/{username}
```

Returns public profile data for a vibecoder.

### Reviews

```
GET /api/reviews?builder_id={uuid}
```

Returns all reviews for a vibecoder.

```
POST /api/reviews
```

Submit a review. **Rate limit:** 3 reviews/day per IP.

**Body:**

```json
{
  "builder_id": "uuid",
  "hire_request_id": "uuid",
  "reviewer_name": "Bob",
  "reviewer_email": "bob@company.com",
  "rating": 5,
  "comment": "Excellent work, delivered on time."
}
```

### Reports

```
POST /api/report
```

Report a project for spam/abuse. **Rate limit:** 10 reports/hour per IP. Returns a `reporter_token` for undo.

```
DELETE /api/report
```

Undo a report using the `reporter_token`.

### Hire Requests

```
GET /api/hire
```

**Requires authentication.** Returns all hire requests for the authenticated vibecoder.

```
POST /api/hire
```

Submit a hire request (no auth required).

```
PATCH /api/hire
```

**Requires authentication.** Update request status or add reply.

```
DELETE /api/hire
```

**Requires authentication.** Delete a hire request.

### Hire Messages

```
GET /api/hire/messages?hire_request_id={uuid}
```

Fetch chat thread for a hire request.

```
POST /api/hire/messages
```

Send a message in a hire chat thread.

**Body:**

```json
{
  "hire_request_id": "uuid",
  "sender_type": "builder",
  "message": "Thanks for reaching out! Let's discuss the project."
}
```

### GitHub Activity Sync

```
POST /api/github/activity
```

**Requires authentication.** Syncs recent GitHub public events (push, PR, issues, repo creation) into streak_logs.

### Cron: Reset Streaks

```
GET /api/cron/reset-streaks
```

**Requires `CRON_SECRET` header.** Called daily by Vercel Cron at 00:00 UTC. Resets streaks for users with no activity in the last 24 hours.

### Share Card

```
GET /api/share-card/{username}
```

Returns a dynamically generated PNG image of a vibecoder's profile card (for social sharing).

## Error Responses

All endpoints return errors in this format:

```json
{
  "error": "Description of what went wrong"
}
```

| Status Code | Meaning |
|---|---|
| `400` | Bad request — invalid input or missing fields |
| `401` | Unauthorized — session required |
| `404` | Not found — user or resource doesn't exist |
| `429` | Too many requests — rate limited |
| `500` | Server error |
