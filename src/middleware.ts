import { updateSession } from "@/lib/supabase/middleware";
import { NextResponse, type NextRequest } from "next/server";

const AUTH_COOKIE_PREFIX = "sb-";
const AUTH_COOKIE_SUFFIX = "-auth-token";

function hasSupabaseAuthCookie(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some(
      (c) =>
        c.name.startsWith(AUTH_COOKIE_PREFIX) &&
        c.name.endsWith(AUTH_COOKIE_SUFFIX),
    );
}

export async function middleware(request: NextRequest) {
  // Catch Supabase auth error redirects (e.g. identity_already_exists)
  // Supabase redirects to the site root with error params when OAuth fails
  const { searchParams } = request.nextUrl;
  const errorCode = searchParams.get("error_code");

  if (errorCode && request.nextUrl.pathname === "/") {
    const errorDescription =
      searchParams.get("error_description") || "Authentication failed";

    // If the user has a Supabase session cookie they're already logged in
    // (e.g. linking GitHub from profile-setup/settings) → send to settings.
    // Otherwise they were signing up/logging in → send to login page.
    const dest = hasSupabaseAuthCookie(request) ? "/settings" : "/auth/login";

    const redirectUrl = new URL(dest, request.url);
    redirectUrl.searchParams.set("error_code", errorCode);
    redirectUrl.searchParams.set("error_description", errorDescription);
    return NextResponse.redirect(redirectUrl);
  }

  // Logged-in users visiting auth pages get bounced to /dashboard immediately,
  // server-side — no client-side flash of the signup/login form.
  // Uses the cookie heuristic (fast, no network call). Edge case: an expired
  // cookie triggers a redirect to /dashboard which the dashboard middleware
  // then redirects back to /auth/login — two hops, but graceful.
  const isAuthPage =
    request.nextUrl.pathname === "/auth/signup" ||
    request.nextUrl.pathname === "/auth/login";
  if (isAuthPage && hasSupabaseAuthCookie(request)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Anonymous visitors on non-protected routes skip updateSession entirely.
  // updateSession calls supabase.auth.getUser() and writes Set-Cookie, which
  // forces `cache-control: no-store` and bypasses both Vercel ISR and the
  // Cloudflare edge — meaning every visit pays the full origin round-trip
  // (Vercel iad1). With no auth cookie there's nothing to refresh anyway.
  // Authenticated users still hit the full code path so the cookie-refresh
  // fix from the previous regression remains intact.
  const isProtectedRoute = request.nextUrl.pathname.startsWith("/dashboard");
  if (!isProtectedRoute && !hasSupabaseAuthCookie(request)) {
    return NextResponse.next({ request });
  }

  return await updateSession(request);
}

// Run middleware on every non-static route so Supabase can refresh the auth
// cookie on each navigation. Restricting this to "/" and "/dashboard/*"
// caused sessions to silently expire on other pages.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
