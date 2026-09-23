# Founder Demand Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture qualified founder briefs from VibeFinder and let the team follow up with manually vetted builder introductions.

**Architecture:** An optional form on `/agent/find` submits the existing project criteria plus contact consent to a server route. The route validates and rate limits the request, inserts it in a private Supabase table with a service-role client, and schedules an operator email. The existing matching results and direct hire flow remain intact.

**Tech Stack:** Next.js App Router, React, TypeScript, Supabase Postgres/RLS, Resend, Vitest, GA4 event helper, Cloudflare Workers.

---

## File structure

- `supabase/migrations/20260923081710_founder_briefs.sql`: table, constraints, RLS, grants, indexes.
- `src/lib/founder-brief.ts`: input types and validation shared by route tests.
- `src/app/api/founder-briefs/route.ts`: anonymous POST with rate limiting, insert, and deferred notification.
- `src/lib/email.ts`: one transactional operator notification using the existing Resend client.
- `src/components/agent/founder-shortlist-form.tsx`: optional contact form and status UI.
- `src/app/agent/find/page.tsx`: render the form after matching, including zero results.
- `src/lib/funnel-events.ts`: categorical pilot events.
- `src/components/homepage/proof-wall-hero.tsx` and `src/components/homepage/fork-hero.tsx`: point the hiring CTA at `/agent/find`.
- `docs/growth/founder-demand-playbook.md`: outreach drafts, qualification and manual follow-up process.

### Task 1: Private brief storage

- [x] **Step 1: Generate the migration file.** `supabase migration new founder_briefs` created `supabase/migrations/20260923081710_founder_briefs.sql`. Never run `supabase db push` because remote history is out of sync.
- [ ] **Step 2: Define `public.founder_briefs`.** Include `id uuid primary key default gen_random_uuid()`, `name`, `email`, `description`, `tech_stack text[]`, `project_type`, `timeline`, `budget`, `source`, `consent_at`, `status default 'new'`, `loss_reason`, and `created_at`. Add bounded text and enum check constraints, indexes on `created_at` and `(email, created_at)`, enable RLS, revoke all from `anon` and `authenticated`, and grant required operations to `service_role` only.

```sql
create table public.founder_briefs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 100),
  email text not null check (char_length(email) <= 254),
  description text not null check (char_length(description) between 20 and 3000),
  tech_stack text[] not null default '{}',
  project_type text not null check (project_type in ('mvp','full_product','bug_fix','consultation')),
  timeline text not null check (timeline in ('asap','1_week','1_month','flexible')),
  budget text not null check (budget in ('under_500','500_2k','2k_5k','5k_plus')),
  source text not null default 'agent_find' check (source = 'agent_find'),
  consent_at timestamptz not null,
  status text not null default 'new' check (status in ('new','qualified','matched','introduced','trial','won','lost')),
  loss_reason text,
  created_at timestamptz not null default now()
);
alter table public.founder_briefs enable row level security;
revoke all on public.founder_briefs from anon, authenticated;
grant select, insert, update, delete on public.founder_briefs to service_role;
```
- [ ] **Step 3: Apply only this SQL file in the Supabase SQL editor or `execute_sql`; do not replay old migrations.** Query `pg_policies`, `information_schema.role_table_grants`, and the table definition afterward. Confirm `anon` and `authenticated` have no table privileges.

### Task 2: Validate and save briefs

- [ ] **Step 1: Write failing tests.** `src/lib/__tests__/founder-brief.test.ts` should cover valid MVP input, invalid email, no consent, short description, invalid enum, and overlong fields. `src/app/api/founder-briefs/__tests__/route.test.ts` should prove validation fails before insert, repeated email is limited, a valid brief stores once, and mail failure cannot turn a stored brief into an error response.
- [ ] **Step 2: Implement `parseFounderBrief(raw: unknown)`.** Return either `{ ok: true, value }` with normalized name/email, trimmed description and tech stack, allowed project type/timeline/budget, `source: 'agent_find'`, and `consent_at`, or `{ ok: false, error }`. Reuse `validateName` and `validateEmail`. Require an explicit `consent === true`.

```ts
type ParsedBrief =
  | { ok: true; value: FounderBriefInsert }
  | { ok: false; error: string };
export function parseFounderBrief(raw: unknown): ParsedBrief;
```
- [ ] **Step 3: Implement POST.** Use a dedicated 5/hour/IP limiter, then `parseFounderBrief`, then service-role count of recent submissions for that email, then insert with `select('id').single()`. Respond `201` with the ID. Schedule `sendFounderBriefNotification` with Next `after()` after insert. Do not expose contact details to analytics or the response.

```ts
const { data, error } = await admin.from('founder_briefs').insert(brief).select('id').single();
if (error) return NextResponse.json({ error: 'Could not save your brief.' }, { status: 500 });
after(() => sendFounderBriefNotification({ ...brief, id: data.id }));
return NextResponse.json({ id: data.id }, { status: 201 });
```
- [ ] **Step 4: Run focused tests and commit.** `npm test -- src/lib/__tests__/founder-brief.test.ts src/app/api/founder-briefs/__tests__/route.test.ts` must pass.

### Task 3: Founder experience and measurement

- [ ] **Step 1: Add `FounderShortlistForm`.** Show it on result and zero-result states without gating self-serve matches. Ask only for name, email, and explicit contact consent; reuse project details from the matcher. Preserve input and show a retry state on API failure; disable double submit and show success after `201`.

```tsx
<FounderShortlistForm
  brief={{ ...form, tech_stack: techInput.split(',').map((tech) => tech.trim()).filter(Boolean) }}
/>
```
- [ ] **Step 2: Add categorical events.** Extend the `FunnelEvent` union with `founder_shortlist_opened`, `founder_brief_submitted`, and `founder_brief_created`. Never include names, emails, descriptions, or user IDs in GA4 events.
- [ ] **Step 3: Route pilot CTAs.** Change the homepage hiring CTAs from `/explore` to `/agent/find` with copy that promises matching, and keep browsing available through `/explore`.
- [ ] **Step 4: Verify the founder UI.** Check keyboard access, narrow layout, missing-results path, success and error messages. Run `./node_modules/.bin/eslint src` and `npx tsc --noEmit`.

### Task 4: Manual operating kit and release

- [ ] **Step 1: Write the playbook.** Define qualification, how to verify builder availability, status updates, five brief/three intro/one trial targets, and separate builder project value from platform revenue. Draft concise, personalized founder and builder outreach templates; send none automatically.
- [ ] **Step 2: Run `npm test` and `npm run cf:build`.** Fix failures, inspect `git diff --check`, and self-review security and copy.
- [ ] **Step 3: Open a PR, inspect feedback, and merge after CI.** Deploy through existing GitHub Actions. Verify the production route and page. Submit a controlled test brief, check row and operator email, then delete the test row.
