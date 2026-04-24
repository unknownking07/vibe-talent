import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Skip auth check if Supabase is not configured
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.next({ request });
  }

  // Short-circuit unauthenticated traffic: no auth cookie means getUser() would
  // round-trip to Supabase just to return null. Skipping that fetch eliminates
  // the hot-path cost for bots, crawlers, and logged-out visitors — the bulk of
  // public traffic — without changing behavior (protected routes still redirect
  // to login, unprotected routes still render anonymously).
  const hasAuthCookie = request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.endsWith("-auth-token"));

  if (!hasAuthCookie) {
    const isProtectedRoute = request.nextUrl.pathname.startsWith("/dashboard");
    if (isProtectedRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/login";
      return NextResponse.redirect(url);
    }
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() must run on every route so Supabase can refresh the auth cookie
  // before it expires. Gating this on /dashboard/* used to leave the cookie
  // stale whenever users sat on /projects, /feed, /profile, etc., and they'd
  // get bounced to login on the next refresh.
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // Only protected routes redirect to login; other routes still benefit from
  // the cookie refresh above.
  const isProtectedRoute = request.nextUrl.pathname.startsWith("/dashboard");
  if (isProtectedRoute && !user) {
    // Fall back to getSession() (local cookie read) on transient network
    // errors so we don't bounce authenticated users on flakiness.
    if (error) {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        return supabaseResponse;
      }
    }
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
