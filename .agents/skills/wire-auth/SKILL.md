---
name: wire-auth
description: Set up authentication end-to-end — auth provider, database sync, row-level security, frontend hooks, and session management. Reads your stack and wires Clerk, NextAuth, or Supabase Auth into your existing project.
category: auth
tags: [auth, clerk, nextauth, supabase, rls, session, security]
author: tushaarmehtaa
---

Set up auth end-to-end — provider, database sync, row-level security, frontend hooks, and session management. RLS and race conditions are in here, not left as an exercise.

## Phase 1: Detect the Stack

Before writing anything, figure out what exists.

### 1.1 Auth Provider
Check for existing auth:
- `@clerk/nextjs` in package.json → Clerk
- `next-auth` in package.json → NextAuth.js
- `@supabase/auth-helpers-nextjs` or `@supabase/ssr` → Supabase Auth
- `firebase/auth` → Firebase Auth
- None → ask the user which to set up

### 1.2 Database
- `@supabase/supabase-js` → Supabase (Postgres)
- `@prisma/client` → Prisma (check schema.prisma for provider)
- `drizzle-orm` → Drizzle
- `mongoose` → MongoDB
- Raw `pg` or `postgres` → Direct Postgres

### 1.3 Frontend Framework
- Next.js App Router vs Pages Router (check for `app/` vs `pages/`)
- React SPA (Vite)
- Other

### 1.4 What's Already Done
- Is there a users table? Read the schema.
- Are there any auth-related API routes?
- Any middleware files?
- Any existing auth hooks or context providers?

Tell the user:
```
Detected: [auth provider] + [database] + [framework]
Users table: [exists / missing]
I'll wire: [list of what needs to be created]
```

## Phase 2: Database Schema

### If no users table exists

**Supabase (SQL):**
```sql
create table users (
  id uuid primary key default gen_random_uuid(),
  auth_id text unique not null,
  email text unique,
  name text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_users_auth_id on users(auth_id);
create index idx_users_email on users(email);
```

**Prisma:**
```prisma
model User {
  id        String   @id @default(uuid())
  authId    String   @unique @map("auth_id")
  email     String?  @unique
  name      String?
  avatarUrl String?  @map("avatar_url")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("users")
}
```

**Drizzle:**
```typescript
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  authId: text('auth_id').unique().notNull(),
  email: text('email').unique(),
  name: text('name'),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
```

### If users table exists
Add `auth_id` column if missing:
```sql
alter table users add column if not exists auth_id text unique;
create index if not exists idx_users_auth_id on users(auth_id);
```

## Phase 3: Row-Level Security (RLS)

**This is the part everyone skips.** Without RLS, any authenticated user can read/write any other user's data if they guess the right ID. RLS makes the database enforce access rules.

### For Supabase

Enable RLS on every table that contains user data:

```sql
-- Enable RLS
alter table users enable row level security;

-- Users can only read their own row
create policy "users_read_own"
  on users for select
  using (auth_id = current_setting('request.jwt.claims')::json->>'sub');

-- Users can only update their own row
create policy "users_update_own"
  on users for update
  using (auth_id = current_setting('request.jwt.claims')::json->>'sub');

-- Backend service role bypasses RLS for admin operations
create policy "service_role_all"
  on users for all
  using (current_setting('role') = 'service_role');
```

For any other user-owned table (e.g., posts, projects, settings), apply the same pattern:
```sql
alter table [table_name] enable row level security;

create policy "[table]_read_own"
  on [table_name] for select
  using (user_id = (
    select id from users where auth_id = current_setting('request.jwt.claims')::json->>'sub'
  ));

create policy "[table]_write_own"
  on [table_name] for insert
  with check (user_id = (
    select id from users where auth_id = current_setting('request.jwt.claims')::json->>'sub'
  ));

create policy "[table]_update_own"
  on [table_name] for update
  using (user_id = (
    select id from users where auth_id = current_setting('request.jwt.claims')::json->>'sub'
  ));

create policy "[table]_delete_own"
  on [table_name] for delete
  using (user_id = (
    select id from users where auth_id = current_setting('request.jwt.claims')::json->>'sub'
  ));
```

**Tell the user:** "RLS is enabled. Even if someone bypasses your frontend, the database itself rejects unauthorized access."

### For Prisma / Drizzle (no built-in RLS)

Add a middleware or helper that filters every query by the current user:
```typescript
// lib/auth-filter.ts
export function forUser(userId: string) {
  return { where: { userId } };
}

// Usage in any route:
const posts = await prisma.post.findMany(forUser(session.user.id));
```

This isn't true RLS but it's the equivalent pattern. Flag to the user that Prisma doesn't enforce this at the database level — it's application-level security.

## Phase 4: Auth Sync Endpoint

The auth provider handles login/signup UI. But you need an endpoint that syncs the authenticated user to YOUR database. This runs on every login.

### Clerk + Supabase (most common indie stack)

**API route** — `app/api/auth/sync/route.ts`:
```typescript
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Service key bypasses RLS
);

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { email, name, imageUrl } = body;

  // Check if user exists
  const { data: existing } = await supabase
    .from('users')
    .select('id, auth_id')
    .eq('auth_id', userId)
    .maybeSingle();

  let isNewUser = false;

  if (!existing) {
    // Also check by email (user might exist from a different auth method)
    const { data: byEmail } = email
      ? await supabase.from('users').select('id').eq('email', email).maybeSingle()
      : { data: null };

    if (byEmail) {
      // Link existing user to this auth provider
      await supabase
        .from('users')
        .update({ auth_id: userId, name, avatar_url: imageUrl })
        .eq('id', byEmail.id);
    } else {
      // Create new user
      await supabase.from('users').insert({
        auth_id: userId,
        email,
        name,
        avatar_url: imageUrl,
      });
      isNewUser = true;
    }
  } else {
    // Update existing user (name/avatar might have changed)
    await supabase
      .from('users')
      .update({ name, avatar_url: imageUrl, updated_at: new Date().toISOString() })
      .eq('auth_id', userId);
  }

  // Fetch the user's current state
  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('auth_id', userId)
    .single();

  return Response.json({
    user,
    isNewUser,
  });
}
```

### NextAuth + Prisma

**Adapter handles sync automatically.** But you need callbacks for extra fields:

```typescript
// app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/prisma';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [/* your providers */],
  callbacks: {
    async session({ session, user }) {
      // Attach database user ID to session
      session.user.id = user.id;
      return session;
    },
    async signIn({ user, account, profile }) {
      // Custom logic on every sign-in (e.g., update last_login)
      await prisma.user.update({
        where: { id: user.id },
        data: { updatedAt: new Date() },
      });
      return true;
    },
  },
});
```

### Supabase Auth (no separate sync needed)

Supabase Auth creates users in `auth.users` automatically. But you likely want a `public.users` table with app-specific fields:

```sql
-- Trigger to auto-create public user on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (auth_id, email, name, avatar_url)
  values (
    new.id::text,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

## Phase 5: Frontend Auth Hook

Create a hook that handles the full auth lifecycle: login state, user sync, and loading states.

### For Clerk + Next.js

```typescript
// hooks/useAuthSync.ts
'use client';

import { useUser } from '@clerk/nextjs';
import { useCallback, useEffect, useRef, useState } from 'react';

interface AuthState {
  user: any | null;
  isNewUser: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export function useAuthSync() {
  const { user: clerkUser, isLoaded, isSignedIn } = useUser();
  const [state, setState] = useState<AuthState>({
    user: null,
    isNewUser: false,
    isLoading: true,
    isAuthenticated: false,
  });

  // Prevent double-sync on React strict mode / fast re-renders
  const syncStarted = useRef(false);

  const syncUser = useCallback(async () => {
    if (!clerkUser || syncStarted.current) return;
    syncStarted.current = true;

    try {
      const res = await fetch('/api/auth/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: clerkUser.primaryEmailAddress?.emailAddress,
          name: clerkUser.fullName,
          imageUrl: clerkUser.imageUrl,
        }),
      });

      const data = await res.json();

      setState({
        user: data.user,
        isNewUser: data.isNewUser,
        isLoading: false,
        isAuthenticated: true,
      });
    } catch {
      setState(prev => ({ ...prev, isLoading: false }));
      syncStarted.current = false; // Allow retry on error
    }
  }, [clerkUser]);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      syncUser();
    } else if (isLoaded && !isSignedIn) {
      setState({ user: null, isNewUser: false, isLoading: false, isAuthenticated: false });
      syncStarted.current = false;
    }
  }, [isLoaded, isSignedIn, syncUser]);

  return state;
}
```

**Critical detail:** The `syncStarted` ref prevents double-sync. Without it, React strict mode calls the effect twice, creating duplicate users or race conditions. This is the bug that costs people 4 hours.

### For NextAuth

```typescript
// hooks/useAuthSync.ts
'use client';

import { useSession } from 'next-auth/react';

export function useAuthSync() {
  const { data: session, status } = useSession();

  return {
    user: session?.user ?? null,
    isNewUser: false, // NextAuth adapter handles creation
    isLoading: status === 'loading',
    isAuthenticated: status === 'authenticated',
  };
}
```

NextAuth is simpler because the adapter handles user creation. The hook is mostly a wrapper.

## Phase 6: Middleware (Route Protection)

### Next.js Middleware

Create `middleware.ts` at the project root:

**Clerk:**
```typescript
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)',
  // Add your public routes here
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: ['/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)'],
};
```

**NextAuth:**
```typescript
export { auth as middleware } from '@/auth';

export const config = {
  matcher: ['/dashboard/:path*', '/settings/:path*', '/api/protected/:path*'],
};
```

### API Route Protection

For any API route that requires auth:

**Clerk:**
```typescript
import { auth } from '@clerk/nextjs/server';

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // ... your logic
}
```

**NextAuth:**
```typescript
import { auth } from '@/auth';

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // ... your logic
}
```

## Phase 7: Environment Variables

List the required env vars based on the chosen stack:

**Clerk + Supabase:**
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

**NextAuth + Prisma:**
```
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=... (generate with: openssl rand -base64 32)
DATABASE_URL=postgresql://...
```

**Supabase Auth:**
```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

Check that none of these are committed to git. If `.env` or `.env.local` isn't in `.gitignore`, add it.

## Phase 8: Verify

Walk through these flows after wiring:

```
Flow 1: New User Signup
[ ] User signs up via auth provider
[ ] Sync endpoint creates user in database
[ ] Frontend hook reflects authenticated state
[ ] isNewUser flag is true (can show onboarding)

Flow 2: Returning User Login
[ ] User signs in
[ ] Sync endpoint finds existing user, updates fields
[ ] Frontend hook loads user data
[ ] isNewUser flag is false

Flow 3: Protected Routes
[ ] Unauthenticated user visiting /dashboard → redirected to sign-in
[ ] Authenticated user visiting /dashboard → sees content
[ ] API route without auth → returns 401

Flow 4: Data Isolation (if RLS enabled)
[ ] User A creates data → only User A can read it
[ ] User B cannot access User A's data even with a direct API call
[ ] Service role (backend) can access all data for admin operations

Flow 5: Edge Cases
[ ] User signs up with email, then signs in with OAuth (same email) → accounts linked
[ ] Token expires → user re-authenticates without data loss
[ ] Multiple tabs open → auth state syncs across tabs
```

Tell the user which flows are wired and which need manual testing.
