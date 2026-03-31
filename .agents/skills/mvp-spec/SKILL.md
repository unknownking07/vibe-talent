---
name: mvp-spec
description: Turn a rough product idea into a structured MVP spec — problem statement, personas, core loop, feature split, data model, API routes, page list, and tech stack recommendation. Write this before touching any code. Triggers on requests like "spec this out", "MVP spec", "plan this product", "what should I build first", "scope this idea", "PRD", "product spec", "write a spec for...", "help me plan this", "what do I build in v1", "product requirements", or any request to structure a product idea before writing code.
category: planning
tags: [mvp, spec, planning, product, prd]
author: tushaarmehtaa
---

The spec you write before touching any code. Turns a rough idea into a buildable v1 with a clean feature cut, data model, and stack recommendation.

## Phase 1: Capture the Idea

Ask for anything missing:

1. **The idea** — What does it do? One sentence.
2. **Who is it for?** — Target user. "Developers" is too vague. "Solo SaaS founders building with Next.js" is specific.
3. **Monetization** — Free, freemium, paid, credits? Skip for now if unclear.
4. **Tech preferences** — Any stack constraints? Or let the skill recommend.

If the user gives you a paragraph, extract these from it and confirm before continuing. Don't ask for what you already have.

## Phase 2: The One-Build Rule

Before writing anything, validate the scope:

- Is this ONE product, or three ideas stapled together?
- Can v1 be built and shipped in 1–2 weeks by one person?
- Is there one clear action the user takes to get value?

If the idea is too broad, cut it. This spec covers v1 only — not the vision, not the roadmap.

**The narrowing question:** "If you could only ship ONE feature this week and it had to deliver real value — what would it be?" That's the core loop. Build the spec around that.

## Phase 3: Feature Split

List every feature that came up. Then sort ruthlessly.

### LAUNCH (ships in v1)

Only features that complete the core loop:

- User can sign up
- User can do the one thing
- User gets value from doing it
- You can see that they got value

### LATER (month 2+)

Everything else. Default everything here unless it's provably required for launch:

- Settings, preferences, notifications
- Team features, collaboration, multi-user
- Admin dashboard
- Analytics dashboards
- Mobile optimization
- Integrations, webhooks, API access

**The test:** "If I remove this, can a user still get value from v1?" Yes → LATER.

## Phase 4: Data Model

Design only for LAUNCH features. Don't model LATER features — the schema will change anyway.

```
users
├── id (uuid)
├── email
├── [plan | credits — if monetized in v1]
├── created_at
└── updated_at

[core resource]
├── id (uuid)
├── user_id → users.id
├── [core fields]
├── created_at
└── updated_at

Relationships:
- users has many [resources]
- [resource] belongs to user
```

One table per entity. No join tables unless collaboration is in v1 (it almost never is).

## Phase 5: API Routes

Only routes LAUNCH features actually need.

```
Auth
POST   /api/auth/signup
POST   /api/auth/login
GET    /api/auth/me

[Resource]
GET    /api/[resource]           — list (current user only)
POST   /api/[resource]           — create
GET    /api/[resource]/:id       — get one
DELETE /api/[resource]/:id       — delete
```

No PUT/PATCH unless editing is core to the loop in v1.

## Phase 6: Pages

Every screen the user sees in v1.

```
/                  — Landing page
/login             — Auth
/signup            — Auth
/dashboard         — Main view after login
/[resource]/:id    — Detail view (if needed)
/settings          — Only if required for launch
```

## Phase 7: Tech Stack

Match the recommendation to the user's stated constraints.

| Priority | Stack |
|----------|-------|
| Ship fastest, solo | Next.js + Supabase + Vercel |
| Full backend control | Next.js + Postgres + Prisma + Railway |
| AI-heavy | Next.js + Vercel AI SDK + Supabase |
| Python backend | FastAPI + Postgres + Supabase Auth |

Always explain why — one sentence per choice. "Supabase: auth + postgres in one service, no separate backend needed for v1."

## Phase 8: Scope Cut List

The most important section. Explicitly list what v1 does NOT build.

```
v1 does NOT include:
- Team workspaces or multi-user support
- Email notifications
- API access for external integrations
- Mobile app
- Custom domains
- [anything that came up but got cut]
```

This prevents scope creep during the build. Reference it every time someone says "just one more thing."

## Verify

```
[ ] Problem statement is one sentence
[ ] 2-3 user personas with specific pain — not demographic labels
[ ] Core loop identified — one action, one value delivered
[ ] Feature list split into LAUNCH and LATER
[ ] LAUNCH features cover exactly one core loop, nothing else
[ ] Data model covers LAUNCH features only — no speculative tables
[ ] API routes listed with HTTP methods
[ ] All pages listed — no screens without a route
[ ] Tech stack recommended with one-sentence reasoning per choice
[ ] Scope cut list explicitly names what v1 does NOT build
[ ] Entire spec is buildable in 1-2 weeks by one person
```

See [references/guide.md](references/guide.md) for full example specs, the one-build rule applied to real product ideas, and data model patterns by product type.
