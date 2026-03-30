# Authentication & Security

VibeTalent uses a defense-in-depth approach with multiple security layers. No single layer is relied upon — even if one fails, the others protect user data.

## Authentication

### Auth Providers

VibeTalent supports three authentication methods via **Supabase Auth**:

| Method | Use Case |
|---|---|
| **GitHub OAuth** | Primary — extracts `github_username` from metadata |
| **Google OAuth** | Alternative social login |
| **Email/Password** | Fallback for users without GitHub/Google |

### Session Management

Sessions are managed by `@supabase/ssr` using HTTP-only cookies:

```
Login → Supabase issues JWT + refresh token
      → Stored in HTTP-only cookies (not localStorage)
      → Middleware refreshes tokens on every /dashboard request
      → Expired tokens trigger redirect to /auth/login
```

**Why cookies over localStorage?**
- HTTP-only cookies can't be accessed by JavaScript (XSS protection)
- Automatically sent with every request (no manual token management)
- Supabase SSR handles refresh rotation automatically

### Auth Middleware

`middleware.ts` runs on every request matching `/dashboard`:

```typescript
// Simplified flow
1. Read session from cookies
2. Call supabase.auth.getUser() to validate
3. If invalid → redirect to /auth/login
4. If valid → continue to page
```

The middleware also refreshes session tokens to prevent expiration during active use.

### Auth Callback

After OAuth login, GitHub/Google redirects to `/auth/callback` which:

1. Exchanges the auth code for a session
2. Checks if user profile exists in `users` table
3. If new user → redirects to `/auth/profile-setup`
4. If existing user → redirects to `/dashboard`

## Row Level Security (RLS)

Every table has RLS enabled. This means even direct database access (via Supabase client) respects access rules.

### Users Table

| Operation | Policy |
|---|---|
| **SELECT** | Public — anyone can view profiles |
| **INSERT** | Authenticated — users create their own profile |
| **UPDATE** | Owner only — `auth.uid() = id` |

### Projects Table

| Operation | Policy |
|---|---|
| **SELECT** | Public — anyone can view projects |
| **INSERT** | Owner only — `auth.uid() = user_id` |
| **UPDATE** | Owner only — `auth.uid() = user_id` |
| **DELETE** | Owner only — `auth.uid() = user_id` |

### Streak Logs

| Operation | Policy |
|---|---|
| **SELECT** | Owner only — `auth.uid() = user_id` |
| **INSERT** | Owner only — `auth.uid() = user_id` |

Streak logs are private — no one else can see your raw activity data. Only the aggregated streak count is public (via the users table).

### Hire Requests

| Operation | Policy |
|---|---|
| **INSERT** | Service role or authenticated users only — `auth.role() = 'service_role' OR auth.uid() IS NOT NULL` |
| **SELECT** | VibeCoder only — `auth.uid() = builder_id` |
| **UPDATE** | VibeCoder only — status changes, replies |
| **DELETE** | VibeCoder only — `auth.uid() = builder_id` |

**Database constraints:**
- `message` must be at least 20 characters
- `sender_email` must match a valid email regex
- `sender_name` must be at least 2 characters

All public-facing hire request submissions go through the API (`/api/hire`), which uses the service role client (`createAdminClient()`) to insert. Direct PostgREST inserts via the anon key are blocked.

### Hire Messages

| Operation | Policy |
|---|---|
| **INSERT** | Service role or authenticated users only — `auth.role() = 'service_role' OR auth.uid() IS NOT NULL` |
| **SELECT** | Public — scoped by hire_request_id |

### Reviews

| Operation | Policy |
|---|---|
| **INSERT** | Service role or authenticated users only — `auth.role() = 'service_role' OR auth.uid() IS NOT NULL` |
| **SELECT** | Public — reviews are visible to everyone |

### Project Reports

| Operation | Policy |
|---|---|
| **INSERT** | Service role or authenticated users only — `auth.role() = 'service_role' OR auth.uid() IS NOT NULL` |
| **DELETE** | Service role only — undo via API with reporter token |

## Rate Limiting

Rate limiting uses **Upstash Redis** with a sliding window algorithm:

| Endpoint | Limit | Window |
|---|---|---|
| `POST /api/streak` | 60 requests | per minute |
| `POST /api/report` | 10 reports | per hour |
| `POST /api/reviews` | 3 reviews | per day |
| `POST /api/hire` | 5 requests | per hour |
| `POST /api/endorsements` | 30 requests | per hour |

### How It Works

```
Request comes in
  → Extract IP from x-forwarded-for header
  → Check Redis: key = "rate_limit:{ip}:{endpoint}"
  → If count < limit → allow, increment counter
  → If count >= limit → return 429 Too Many Requests
  → If Redis is down → allow request (graceful degradation)
```

**Graceful degradation** is intentional: we'd rather allow some extra requests during a Redis outage than block all users.

### Rate Limit Response

```json
{
  "error": "Too many requests. Please try again later."
}
```

HTTP status: `429 Too Many Requests`

## Input Validation & Sanitization

### String Validation

All text inputs are:
- **Trimmed** of leading/trailing whitespace
- **Length-limited** (title: 100 chars, description: 2000 chars, bio: 500 chars)
- **Type-checked** — missing or wrong type returns 400

### Email Validation

```
1. Regex format check (standard email pattern)
2. Disposable email blocklist check
```

**Blocked email domains** (defined in `src/lib/validation.ts`):
`mailinator.com`, `guerrillamail.com`, `tempmail.com`, `throwaway.email`, `10minutemail.com`, `trashmail.com`, `fakeinbox.com`, `sharklasers.com`, `guerrillamailblock.com`, `grr.la`, `yopmail.com`, `maildrop.cc`, `dispostable.com`, `temp-mail.org`, `getnada.com`, `test.com`, `example.com`

### URL Validation

- Must start with `http://` or `https://`
- GitHub URLs must be on `github.com` domain

### Name Validation

- Letters, spaces, hyphens, and apostrophes only
- Minimum 2 characters

## API Security

### Cron Job Protection

The daily streak reset cron (`/api/cron/reset-streaks`) requires a `CRON_SECRET` header:

```
GET /api/cron/reset-streaks
Authorization: Bearer {CRON_SECRET}
```

Without the correct secret, the endpoint returns 401.

### Public API (v1)

The `/api/v1/` endpoints are public and include CORS headers:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

These endpoints serve read-only vibecoder data and accept hire requests — no authentication required by design (to enable AI agent integrations).

### No Secrets in Client Code

- `NEXT_PUBLIC_*` variables are limited to Supabase URL and anon key (both are designed to be public)
- All sensitive keys (`RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `UPSTASH_*`) are server-only
- Service role key is used by `createAdminClient()` (in `src/lib/supabase/admin.ts`) for all API mutations — the function throws if the key is missing, preventing silent fallback to the anon key

## Threat Model

| Threat | Mitigation |
|---|---|
| **Unauthorized data access** | RLS policies on every table |
| **Session hijacking** | HTTP-only cookies, token rotation |
| **Brute force** | Rate limiting on sensitive endpoints |
| **Spam/abuse** | Disposable email blocking, report system, auto-flagging |
| **XSS** | React's built-in escaping, database-level input constraints |
| **Direct PostgREST abuse** | RLS blocks anonymous inserts; all mutations use service role via API |
| **CSRF** | Supabase Auth uses SameSite cookies |
| **API abuse** | Rate limiting, input validation |
| **Data leakage** | Server-only secrets, no sensitive data in client bundle |
