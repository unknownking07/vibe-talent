# Private hire contact flow

## Context

GitHub-only builders can already receive hire requests through the profile's Hire button. The request is stored in `hire_requests`, an in-app notification is created, and the email path addresses the builder's Supabase Auth email. A production count on 2026-09-22 found 216 profiles with an Auth email and none without one. The UI does not explain this to builders or clients, so the absence of a public X handle looks like a missing contact path.

## Decision

Keep the builder's sign-in email private and do not add a required onboarding field. An extra contact requirement would recreate the signup friction removed when X and Telegram became optional. A public contact email is a separate, opt-in feature if builders later ask for direct outreach.

## Experience

- On the onboarding Links step, show the signed-in builder the email address that receives hire notifications. Explain that clients use the Hire button and that the address is not shown publicly. If Auth has no email, explain that requests still appear in the dashboard. This is informational and never gates Next.
- Under the public profile's Hire button, say that requests are private and reach the builder's VibeTalent inbox. Do not render their email address in public data or HTML.
- In the hire form, explain that the client shares their own entered email with the builder, and that the builder's address stays private. After submission, describe the request as saved and link to the conversation rather than promising an email was delivered.

## Delivery and failure behavior

`POST /api/hire` remains the entry point and persists the request before `after()` runs the notification work. The notification continues to use the Auth email; no database migration is needed. Check the Resend API result for a returned error and log it. A missing Auth email or email-provider failure must not erase the stored request or its in-app path.

## Verification

Add a focused test for Resend's returned error, run the existing hire notification and route tests, TypeScript, source lint, and the Cloudflare build. Inspect the rendered surfaces for accidental public email exposure. Production smoke tests should confirm the public profile and hire route remain available; actual email delivery requires provider logs or a consented test recipient.
