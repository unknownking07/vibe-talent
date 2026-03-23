# Marketplace & Hiring

## Explore Page

The explore page (`/explore`) is the main talent marketplace where clients discover builders.

### Filtering

Clients can filter builders by:

- **Skills/Tech Stack** — Search for specific technologies (React, TypeScript, Python, etc.)
- **Badge Level** — Filter by reputation tier
- **Sort Order** — Vibe Score (default), Streak, or Project Count

### Builder Cards

Each card shows:
- Username, avatar, and bio
- Current streak with fire indicator
- Badge level
- Vibe Score
- Top tech stack tags
- Link to full profile

---

## Leaderboard

The leaderboard (`/leaderboard`) ranks all builders with three sort modes:

| Sort | Description |
|---|---|
| **Vibe Score** | Overall reputation (default) |
| **Streak** | Longest active builders |
| **Projects** | Most prolific shippers |

The leaderboard updates in real-time as builders log activity and ship projects.

---

## Public Profiles

Every builder has a public profile at `/profile/{username}` featuring:

### Profile Header
- Avatar, username, bio
- Badge display
- Vibe Score
- Current streak counter
- Social links (Twitter, GitHub, Telegram, Farcaster, website)

### Activity Heatmap
- GitHub-style contribution graph
- Shows daily activity over the past year
- Visual proof of consistency

### Project Gallery
- Grid of shipped projects with images
- Tech stack tags
- Links to live demos and GitHub repos

### Reviews Section
- Star ratings (1-5) from clients
- Written testimonials
- Connected to hire requests for context

### Share Card
- Dynamically generated profile image (`/api/share-card/{username}`)
- Optimized for social media sharing
- Shows key stats at a glance

---

## Hire Request Flow

The hiring process is designed to be low-friction for clients and manageable for builders.

### Step 1: Client Submits Request

```
Client visits builder profile
  → Clicks "Hire" button
  → Fills form: name, email, message, budget
  → No account required
  → POST /api/hire
```

**Validation:**
- Name: letters/spaces/apostrophes, min 2 chars
- Email: valid format, not on disposable email blocklist
- Message: required, max 2000 chars
- Budget: required, max 200 chars

### Step 2: Builder Gets Notified

```
After hire request is saved:
  → Email notification sent via Resend
  → Email includes client name, message, budget
  → Builder can view in /dashboard
```

### Step 3: Builder Reviews & Responds

Builders see all hire requests in their dashboard:

| Status | Meaning |
|---|---|
| `new` | Unread request |
| `read` | Builder has seen it |
| `replied` | Builder has responded |

Builders can:
- **Read** — Mark as read
- **Reply** — Send a response (also sets status to `replied`)
- **Delete** — Remove unwanted requests

### Step 4: Chat Thread

After the initial exchange, both parties can continue the conversation:

```
/hire/chat/{requestId}
  → Real-time message exchange
  → sender_type: "builder" or "client"
  → Client accesses via request ID (acts as access token)
  → No account required for client
```

### Step 5: Review

After the engagement, clients can leave a review:

```
POST /api/reviews
  → Rating: 1-5 stars
  → Comment: written feedback
  → Linked to the hire_request for context
  → Rate limit: 3 reviews/day per IP
```

---

## Email Notifications

VibeTalent sends email notifications via **Resend** for:

| Event | Recipient | Content |
|---|---|---|
| New hire request | Builder | Client name, message, budget |

Email is sent as fire-and-forget (using service role key) to avoid blocking the API response. If the email fails, the hire request is still saved — the builder will see it in their dashboard.

---

## Security Considerations

### No Auth Required for Hiring

This is by design. Requiring clients to create an account would add friction and reduce hire requests. Instead, we protect against abuse with:

- **Disposable email blocking** — 15+ blocked providers
- **Rate limiting** — Prevents spam submissions
- **Report system** — Community-driven spam detection
- **Input validation** — Length limits, format checks

### Request ID as Access Token

The hire request UUID doubles as an access token for the chat:
- Only the client who receives the request ID can access the chat
- Request IDs are UUIDs (practically unguessable)
- Chat access is scoped to the specific hire request
