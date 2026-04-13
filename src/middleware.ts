import { updateSession } from "@/lib/supabase/middleware";
import { NextResponse, type NextRequest } from "next/server";

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
    const hasSession = request.cookies
      .getAll()
      .some((c) => c.name.startsWith("sb-") && c.name.endsWith("-auth-token"));
    const dest = hasSession ? "/settings" : "/auth/login";

    const redirectUrl = new URL(dest, request.url);
    redirectUrl.searchParams.set("error_code", errorCode);
    redirectUrl.searchParams.set("error_description", errorDescription);
    return NextResponse.redirect(redirectUrl);
  }

  return await updateSession(request);
}

export const config = {
  matcher: ["/", "/dashboard/:path*"],
};
