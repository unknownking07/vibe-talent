# Founder demand pilot

## Decision

Start with early-stage founders who need a web MVP or internal product built. This is a pilot assumption: VibeTalent's public verified work is strongest in React, TypeScript, Next.js, and Supabase. Sell a curated introduction to builders with relevant shipped work, not a guaranteed delivery date or a claim that a streak proves availability.

The first target is five qualified founder briefs, three accepted introductions, and one paid trial project within two weeks. A qualified brief has a decision maker, concrete scope, timing, and a budget range. These are operating targets, not claims about current demand. A paid trial is money earned by a builder, not VibeTalent revenue. Track those separately. After founders accept introductions, test willingness to pay a managed matching fee in a manual conversation before adding payment UI or changing the site's zero-fee promise.

## Why this pilot

On September 23, production has 216 accounts, 84 builders with a public project, 57 with a verified public project, and 35 with a verified public project and live URL. The database records no hire request in the last 30 days. `/agent/find` already collects a project description, project type, timeline, budget, and skills, but keeps the brief only in browser state. A founder who sees matches but does not choose a builder leaves no follow-up path.

Three approaches were considered:

1. Manual outreach alone is fastest and should run in parallel, but cannot recover an inbound founder who leaves after browsing.
2. Brief capture plus human matching is the chosen pilot. It adds a durable lead and direct follow-up while preserving the existing self-serve matching and direct hire flow.
3. Automated checkout, ranking, and paid acquisition would add cost and complexity before VibeTalent has evidence that founders accept matches or buy trials.

## Founder journey

The primary pilot link points to the existing `/agent/find` project form. The form still shows algorithmic matches without requiring an account or email. On results, including an empty result, offer **Get a human shortlist**. A founder can submit their name and email along with the project brief already entered. The UI explains that VibeTalent will contact them about this request and asks for explicit consent. It does not claim the listed builders are available; the team confirms availability before any introduction.

The submission is saved once to a private `founder_briefs` table with source, project details, contact details, consent timestamp, and status `new`. The server validates lengths and enum values, limits repeat submissions, and inserts with the service role. RLS denies browser reads and writes. An operator notification is sent through existing Resend infrastructure after the row is saved; email failure must not lose the brief. A clear success state tells the founder the request was received. On failure, the form retains their input and offers retry.

The existing direct `Hire This Builder` route and private chat remain available. A general brief does not create a `hire_requests` row, because it has no chosen builder.

## Operating process

Review new briefs daily in Supabase. Qualify scope, budget, timing, and decision authority. For each qualified brief, inspect relevant verified projects and ask candidate builders if they are available before introducing them. Record status changes (`new`, `qualified`, `matched`, `introduced`, `trial`, `won`, `lost`) and a loss reason. No founder or builder messages are sent automatically by this pilot. Draft tailored outreach to founders outside the site, then send only when explicitly authorized by the owner.

## Measurement

Track the existing hire funnel plus `founder_shortlist_opened`, `founder_brief_submitted`, and `founder_brief_created`. Database rows are the source of truth for briefs, introductions, and trials; GA4 events only locate UI drop-off. Review weekly: visits to `/agent/find`, match results, shortlist opens, completed briefs, qualified briefs, introductions accepted, trials started, and paid outcomes. Do not interpret profile-view rows as unique site visitors.

## Verification

Test validation, spam limits, RLS, successful insert, operator notification failure, retry behavior, and that direct hire still works. Run the repo's test, lint, type-check, and Cloudflare build commands. After deploying, submit a controlled test brief, verify its private row and operator email, then delete the test row.
