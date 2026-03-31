---
name: ship-email
description: Scaffold transactional and campaign email infrastructure end-to-end — provider setup, templates, user segmentation, and admin send UI. Use when the user wants to add email to their app — welcome emails, notifications, re-engagement, or bulk campaigns. Triggers on requests like "add email", "set up Resend", "email campaigns", "transactional email", "send emails to users", "welcome email", "notification emails", or any mention of email sending in an app context.
category: infrastructure
tags: [email, resend, transactional, campaigns, deliverability]
author: tushaarmehtaa
---

Scaffold complete email infrastructure — Resend setup, transactional templates, user segmentation, and an admin send UI. Reads the project first, plugs into existing auth and database.

## Phase 1: Detect the Project

Before writing anything, read the codebase:

### 1.1 Stack Detection
- **Framework**: Next.js / Express / FastAPI / other?
- **Database**: Supabase / Prisma / Drizzle / Mongoose / raw SQL?
- **Auth**: What fields identify a user? (`clerk_user_id`, `email`, `id`)
- **User table schema**: What fields exist? (`email`, `name`, `credits`, `plan`, `created_at`, `last_active_at`)

### 1.2 Ask the User

Before scaffolding, confirm:

```
I'll wire email for your [framework] app with [database].

Quick decisions:

1. What emails do you need? (transactional, campaigns, or both)
2. Sender: From name and from email? (e.g., "Tushar from Bangers Only <hi@bangersonly.xyz>")
3. Domain verified in Resend? (yes / need to set it up)

Defaults: welcome email + re-engagement campaign, Resend.
```

## Phase 2: Provider Setup

### Install and Configure Resend

```bash
npm install resend
```

Add to `.env.example`:
```
RESEND_API_KEY=re_xxxxx
```

Create the email utility — every email in the codebase goes through this:

```typescript
// lib/email.ts
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
}

export async function sendEmail({
  to,
  subject,
  html,
  from = 'Your Name <you@yourdomain.com>',
  replyTo,
}: SendEmailParams) {
  try {
    const result = await resend.emails.send({ from, to, subject, html, reply_to: replyTo });
    return { success: true, id: result.data?.id };
  } catch (error) {
    console.error('Email send failed:', error);
    return { success: false, error };
  }
}
```

**Never throw from the email utility.** Email failures should not crash the main request flow. Return `{ success, error }` and let the caller decide.

### Domain Verification Checklist

Tell the user to complete this in the Resend dashboard before going to production:

```
[ ] Add MX record to DNS
[ ] Add SPF TXT record: v=spf1 include:resend.com ~all
[ ] Add DKIM TXT records (Resend provides these in dashboard)
[ ] Verify domain status shows "Verified" in Resend dashboard
[ ] Set reply-to to a monitored inbox (not noreply)
```

Without domain verification, emails land in spam or don't send at all.

## Phase 3: Email Templates

Create templates for the events that exist in the codebase. At minimum, scaffold these:

### Welcome Email (triggers on user signup)

```typescript
// lib/emails/welcome.ts
export function welcomeEmail({ name, ctaUrl }: { name: string; ctaUrl: string }): string {
  return `
    <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px; color: #111;">
      <p>Hey ${name},</p>
      <p>You're in. Here's what to do first:</p>
      <p>
        <a href="${ctaUrl}"
           style="display: inline-block; background: #000; color: #fff; padding: 12px 24px;
                  text-decoration: none; border-radius: 6px; font-size: 14px;">
          Get started
        </a>
      </p>
      <p>Any questions — just reply to this email.</p>
      <p style="color: #666; font-size: 13px; margin-top: 40px;">— [Your Name]</p>
      <p style="color: #999; font-size: 11px;">
        <a href="{{{unsubscribe_url}}}" style="color: #999;">Unsubscribe</a>
      </p>
    </div>
  `;
}
```

### Re-engagement Email (triggers for users inactive 7+ days)

```typescript
// lib/emails/reengagement.ts
export function reengagementEmail({ name, daysSinceActive }: { name: string; daysSinceActive: number }): string {
  return `
    <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px; color: #111;">
      <p>Hey ${name},</p>
      <p>Haven't seen you in ${daysSinceActive} days. [Product] has [one improvement since they last used it].</p>
      <p>
        <a href="[APP_URL]"
           style="display: inline-block; background: #000; color: #fff; padding: 12px 24px;
                  text-decoration: none; border-radius: 6px; font-size: 14px;">
          Pick up where you left off
        </a>
      </p>
      <p style="color: #666; font-size: 13px; margin-top: 40px;">— [Your Name]</p>
      <p style="color: #999; font-size: 11px;">
        <a href="{{{unsubscribe_url}}}" style="color: #999;">Unsubscribe</a>
      </p>
    </div>
  `;
}
```

### Template Rules
- Plain text feel — no heavy HTML design
- One CTA per email
- Signed by a human name, not "The Team"
- Every template must include an unsubscribe link for campaigns
- Inline styles only — no external stylesheets (spam filters strip them)

### Wire Welcome Email Into Signup Flow

Find the signup/auth sync endpoint and call `sendEmail` after user creation:

```typescript
// After creating the new user:
if (isNewUser) {
  await sendEmail({
    to: user.email,
    subject: 'Welcome',
    html: welcomeEmail({ name: user.name || 'there', ctaUrl: process.env.APP_URL! }),
  });
}
```

## Phase 4: User Segmentation

Read the user table schema and generate segments based on available fields:

| If table has... | Generate these segments |
|---|---|
| `credits` / `usage_count` | Power (top 20%), Active (middle 60%), Inactive (bottom 20%) |
| `created_at` | New (<7 days), Established (7-30 days), Veteran (30+ days) |
| `plan` / `subscription_tier` | Free, Paid, Churned |
| `last_active_at` | Active (<7 days), Dormant (7-30 days), Churned (30+ days) |

Generate the actual SQL/ORM query for each segment that exists. Example for credits-based app:

```sql
-- Dormant users: used some credits but went quiet
SELECT email, name
FROM users
WHERE (initial_credits - credits) > 0
  AND last_active_at < NOW() - INTERVAL '7 days'
  AND email_unsubscribed = false;
```

## Phase 5: Admin Campaign UI

If campaigns are requested, scaffold an admin route:

```
POST /api/admin/send-campaign
Body: { segment: string, templateId: string }
```

Handler logic:
1. Check admin auth — never skip this
2. Query users in segment
3. Loop and send — catch per-email errors, don't abort the batch on one failure
4. Return `{ sentCount, failedEmails, errors }`

```typescript
// api/admin/send-campaign/route.ts
export async function POST(req: Request) {
  const adminSecret = req.headers.get('x-admin-secret');
  if (adminSecret !== process.env.ADMIN_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { segment, templateId } = await req.json();
  const users = await getUsersInSegment(segment);

  let sentCount = 0;
  const failedEmails: string[] = [];

  for (const user of users) {
    const result = await sendEmail({
      to: user.email,
      subject: getSubjectForTemplate(templateId),
      html: renderTemplate(templateId, user),
    });

    if (result.success) {
      sentCount++;
    } else {
      failedEmails.push(user.email);
    }
  }

  return Response.json({ sentCount, failedEmails });
}
```

**Rate limit awareness**: Resend free tier = 100 emails/day. Paid starts at $20/mo for 50,000/day. If segment is larger than the daily limit, add batch delays or warn the user.

## Phase 6: Unsubscribe Mechanism

Every campaign email needs a working unsubscribe. This isn't optional — it's both legal and a deliverability requirement.

```typescript
// lib/unsubscribe.ts
import { createHmac } from 'crypto';

export function generateUnsubToken(email: string): string {
  return createHmac('sha256', process.env.UNSUB_SECRET!)
    .update(email)
    .digest('hex')
    .slice(0, 16);
}

export function unsubUrl(email: string): string {
  const token = generateUnsubToken(email);
  return `${process.env.APP_URL}/unsubscribe?email=${encodeURIComponent(email)}&token=${token}`;
}
```

Add `email_unsubscribed boolean DEFAULT false` to the users table if it doesn't exist. The unsubscribe route sets it to true and all segment queries must filter on `email_unsubscribed = false`.

## Phase 7: Verify

```
Flow 1: Transactional
[ ] User signs up → welcome email arrives in inbox (not spam)
[ ] Email shows from verified domain, not @resend.dev
[ ] Reply-to is a real inbox

Flow 2: Campaigns
[ ] Admin send-campaign endpoint requires auth
[ ] Segment query returns correct users
[ ] Failed individual emails don't abort the batch
[ ] Response shows sentCount and failedEmails

Flow 3: Unsubscribe
[ ] Unsubscribe link in every campaign email
[ ] Clicking it marks user as unsubscribed in DB
[ ] Unsubscribed users excluded from future segments

Flow 4: Edge Cases
[ ] sendEmail never throws — returns { success: false } on failure
[ ] Email sending doesn't block the main signup flow
[ ] RESEND_API_KEY in .env.example (not in code)
```

## Important Notes

- **Never hardcode email addresses.** Use env vars for from/reply-to.
- **Welcome email timing matters.** Send it in the background — don't make signup wait for email delivery.
- **Test with Resend's test mode** before switching to live API key.
- **One email per event.** Don't fire multiple emails on the same trigger — users notice.

See [references/guide.md](references/guide.md) for email copy by segment, subject line formulas, and rate limiting patterns.
