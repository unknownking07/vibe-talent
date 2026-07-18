import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Skip auth check if Supabase is not configured
  if (!supabaseUrl || !supabaseKey) {
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
    // getUser() failing WITH an auth cookie present is a refresh that raced or
    // a transient auth-server blip — not proof of logout. This bites hardest
    // overnight: a tab reopened after midnight carries an hours-expired access
    // token, and one flaky refresh used to bounce a logged-in user to
    // /auth/login. getSession() can't arbitrate (it re-attempts the refresh
    // that just failed and returns null), so let the request through and let
    // the client resolve the real state — the dashboard renders its own
    // signed-out UI, and a genuinely dead session clears the cookie on the
    // client, making the next navigation redirect normally.
    if (error && hasAuthSessionCookie(request)) {
      return supabaseResponse;
    }
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

// Matches @supabase/ssr session cookies, including chunked ones
// (sb-<ref>-auth-token, sb-<ref>-auth-token.0, .1, …) while excluding the
// PKCE sb-<ref>-auth-token-code-verifier cookie that mid-OAuth visitors carry.
export function hasAuthSessionCookie(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some(
      (c) =>
        /^sb-.+-auth-token(\.\d+)?$/.test(c.name) && c.value.length > 0,
    );
}
