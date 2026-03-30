# Deployment & Infrastructure

## Hosting

VibeTalent is deployed on **Vercel**, optimized for Next.js with:

- Automatic builds on push to `main`
- Edge functions for API routes
- Serverless functions for dynamic pages
- Global CDN for static assets
- Automatic HTTPS

## Environment Setup

### Vercel Environment Variables

Set these in the Vercel dashboard under **Settings > Environment Variables**:

| Variable | Required | Scope |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | All |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | All |
| `NEXT_PUBLIC_SITE_URL` | Yes | All |
| `RESEND_API_KEY` | No | Server |
| `UPSTASH_REDIS_REST_URL` | No | Server |
| `UPSTASH_REDIS_REST_TOKEN` | No | Server |
| `CRON_SECRET` | Yes | Server |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server |
| `NEXT_PUBLIC_GA_ID` | No | All |

### Supabase Setup

1. Create a new Supabase project
2. Run the SQL migrations to create tables, functions, and RLS policies
3. Enable GitHub and Google OAuth providers
4. Create a `project-images` storage bucket (public)
5. Configure allowed redirect URLs for OAuth

## Cron Jobs

### Daily Streak Reset

Configured in `vercel.json`. All cron endpoints require `CRON_SECRET` — Vercel automatically includes this for cron-triggered requests.

| Job | Path | Schedule | Description |
|---|---|---|---|
| **Reset Streaks** | `/api/cron/reset-streaks` | Daily 00:00 UTC | Reset expired streaks, recalculate vibe scores |
| **Streak Warning** | `/api/cron/streak-warning` | Daily 18:00 UTC | Email + in-app notification for at-risk streaks |
| **GitHub Sync** | `/api/cron/github-sync` | Daily | Sync GitHub contribution data for all users |
| **Check Live URLs** | `/api/cron/check-live-urls` | Weekly | Verify project live URLs are still reachable |
| **Reset Freezes** | `/api/cron/reset-freezes` | Monthly 1st | Reset streak freeze allowance to 3 |

## Caching Strategy

### Server-Side Caching

Server Components use `unstable_cache` with 60-second revalidation:

```typescript
const getTopBuilders = unstable_cache(
  async () => { /* Supabase query */ },
  ['top-builders'],
  { revalidate: 60 }
);
```

This means:
- First request hits the database
- Subsequent requests (within 60s) serve from cache
- After 60s, the next request triggers a background revalidation

### What's Cached

| Data | TTL | Why |
|---|---|---|
| Leaderboard rankings | 60s | Frequently viewed, rarely changes |
| VibeCoder profiles | 60s | Balance freshness with performance |
| Project listings | 60s | New projects can wait a minute |

### What's NOT Cached

- Streak logging (must be real-time)
- Hire requests (vibecoders need to see new requests immediately)
- Auth operations (must be fresh)

## Image Handling

### Project Images

- Stored in Supabase Storage (`project-images` bucket)
- Public read access via CDN
- Uploaded from the vibecoder dashboard

### Allowed Image Domains

Next.js Image component is configured to allow:

```
*.supabase.co           — Project images
avatars.githubusercontent.com — GitHub avatars
lh3.googleusercontent.com    — Google avatars
```

## Monitoring & Observability

### Google Analytics

Optional tracking via `NEXT_PUBLIC_GA_ID` for:
- Page views
- User flows
- Feature adoption

### Error Handling

- API routes return structured error JSON
- Server Components use `ErrorBoundary` for graceful degradation
- Rate limit failures return 429 with clear messages
- Redis failures degrade gracefully (allow requests through)

## SEO

### Sitemap

Auto-generated at `/sitemap.xml` including:
- Landing page
- Explore page
- Leaderboard
- All public vibecoder profiles

### Robots.txt

Generated at `/robots.txt` to guide search engine crawlers.

### Meta Tags

- Open Graph tags on all public pages
- Twitter Card tags for social sharing
- Dynamic share cards for vibecoder profiles (`/api/share-card/{username}`)

## Scaling Considerations

| Component | Current | Scale Path |
|---|---|---|
| **Database** | Supabase Free/Pro | Supabase Enterprise or self-hosted Postgres |
| **Rate Limiting** | Upstash Redis | Scale with Upstash plan |
| **File Storage** | Supabase Storage | S3/CloudFront for high volume |
| **Compute** | Vercel Serverless | Vercel Enterprise or self-hosted |
| **Email** | Resend | Scale with Resend plan |
