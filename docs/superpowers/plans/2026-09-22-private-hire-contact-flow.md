# Private Hire Contact Flow Implementation Plan

> **For agentic workers:** Implement these checked tasks inline in this session. The user asked to execute the approved private-contact design.

**Goal:** Make it obvious that builders can be hired without a public X handle or email, and surface failures in the existing email notification path.

**Architecture:** Supabase Auth remains the private notification address. Onboarding reads the signed-in user's email only for their own screen; public profile and hire form describe the existing request flow without fetching that address. The hire request API continues persisting first and notifying in `after()`.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase Auth, Resend, Vitest.

---

### Task 1: Explain private contact in onboarding

**Files:** Modify `src/app/auth/profile-setup/page.tsx`.

- [x] Set `contactEmail` from `user.email` in the existing authenticated `checkAuth` effect.
- [x] Add an informational card to the Links step. When present, render the email only to that signed-in user, plus: “Hire requests arrive in your VibeTalent inbox and we email this address. Your email is never shown on your public profile.” When absent, render: “Hire requests still arrive in your VibeTalent inbox. Email notifications are unavailable until your account has an email.”
- [x] Keep the Next button's current GitHub verification requirement; do not add email validation or storage.

### Task 2: Clarify the public hire path

**Files:** Modify `src/components/profile/profile-sidebar.tsx` and `src/components/ui/hire-modal.tsx`.

- [x] Under “Hire This Builder,” add text: “Send a private request to this builder's VibeTalent inbox.”
- [x] At the top of the form, explain that the client's entered email is shared with the builder for follow-up while the builder's email stays private.
- [x] On success, say the request is saved and the builder can see it in their inbox; keep the existing conversation link. Avoid claiming an email was delivered.
- [x] Verify public profile rendering never includes the builder's Auth email.

### Task 3: Surface Resend response errors

**Files:** Modify `src/lib/email.ts`; test in `src/lib/__tests__/hire-email.test.ts`.

- [x] Write a failing Vitest test with a mocked Resend `emails.send` that resolves `{ data: null, error: new Error("provider rejected") }`. Assert `sendHireNotification` logs the provider error while resolving so the stored hire request remains successful.
- [x] Run `npx vitest run src/lib/__tests__/hire-email.test.ts` and confirm the test fails before the code change.
- [x] In `sendHireNotification`, inspect the result from `sendEmail`. Throw its `error` when present so the existing catch logs it.
- [x] Run the focused test and `src/lib/__tests__/hire-notifications.test.ts`.

### Task 4: Verify and ship

**Files:** No additional source files.

- [x] Run `npm run test`, `npx tsc --noEmit`, `./node_modules/.bin/eslint src`, and `npm run cf:build`.
- [ ] Inspect the diff and commit only this feature's files, preserving unrelated workspace changes.
- [ ] Push a PR, wait for required checks, merge when clean, and confirm the Cloudflare deploy and public hire page/API smoke tests.
