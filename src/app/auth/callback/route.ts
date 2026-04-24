import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

// Only allow same-origin relative paths. Rejects:
//   - missing/empty leading slash ("dashboard", ".evil.com")
//   - protocol-relative URLs ("//evil.com")
//   - backslash tricks browsers may normalize to "/" ("/\evil.com")
//   - embedded schemes
//   - any ASCII control chars (U+0000–U+001F, U+007F) including CR/LF — blocks
//     header-injection shapes like "/dashboard\r\nLocation: https://evil.com"
const CONTROL_CHARS = /[\x00-\x1F\x7F]/;
export function sanitizeNext(raw: string | null): string {
  if (!raw) return "/dashboard";
  if (CONTROL_CHARS.test(raw)) return "/dashboard";
  if (!raw.startsWith("/")) return "/dashboard";
  if (raw.startsWith("//") || raw.startsWith("/\\")) return "/dashboard";
  if (raw.includes("\\")) return "/dashboard";
  return raw;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = sanitizeNext(searchParams.get("next"));

  if (code) {
    const cookieStore = await cookies();

    // Build the redirect response first so cookies can be forwarded onto it
    const redirectTo = `${origin}${next}`;
    const forwardedResponse = NextResponse.redirect(redirectTo);

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
              forwardedResponse.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Pull avatar from OAuth provider if user doesn't have one
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const oauthAvatar =
          user.user_metadata?.avatar_url ||
          user.user_metadata?.picture ||
          null;

        // Find the GitHub identity in the user's linked identities.
        // This handles both initial GitHub OAuth signup AND linkIdentity
        // flows where a Google/email user links their GitHub account later.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const githubIdentity = user.identities?.find((i: any) => i.provider === "github");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ghData = (githubIdentity?.identity_data ?? {}) as any;
        const githubUsername =
          ghData.user_name ||
          ghData.preferred_username ||
          user.user_metadata?.user_name ||
          user.user_metadata?.preferred_username ||
          null;

        // Use service role client for DB operations to bypass RLS
        const adminSb = createAdminClient();

        const { data: profile } = await adminSb
          .from("users")
          .select("username, avatar_url, github_username")
          .eq("id", user.id)
          .single();

        if (profile) {
          const updates: Record<string, string> = {};

          // Always sync avatar from OAuth provider on login
          if (oauthAvatar) {
            updates.avatar_url = oauthAvatar;
          }

          if (githubUsername) {
            updates.github_username = githubUsername;
          }

          // NOTE: display_name is intentionally NOT touched here. Profile-setup
          // step 1 already pre-fills it from user_metadata.full_name for new
          // users, so first-time signups still get a nice default to accept
          // or edit. Leaving the callback out of display_name means users who
          // intentionally clear the field in settings won't have it restored
          // on their next OAuth login.

          if (Object.keys(updates).length > 0) {
            await adminSb
              .from("users")
              .update(updates)
              .eq("id", user.id);
          }
        }

        // Auto-populate the public social link to the verified GitHub handle
        // so profiles display GitHub without requiring manual entry.
        if (githubUsername) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (adminSb.from("social_links") as any).upsert(
            { user_id: user.id, github: githubUsername },
            { onConflict: "user_id" }
          );
        }

        // Send first-time users (email confirm or OAuth) to profile setup
        // unless the caller explicitly asked for a specific destination
        const hasExplicitNext = searchParams.get("next") !== null;
        if (!profile?.username && !hasExplicitNext) {
          const setupResponse = NextResponse.redirect(`${origin}/auth/profile-setup`);
          forwardedResponse.cookies.getAll().forEach((c) => {
            setupResponse.cookies.set(c);
          });
          return setupResponse;
        }
      }

      return forwardedResponse;
    }
  }

  // Pass through the specific Supabase error if available
  const errorCode = searchParams.get("error_code");
  const errorDescription = searchParams.get("error_description");
  const loginUrl = new URL("/auth/login", origin);
  if (errorCode) {
    loginUrl.searchParams.set("error_code", errorCode);
    loginUrl.searchParams.set("error_description", errorDescription || "Authentication failed");
  } else {
    loginUrl.searchParams.set("error_code", "auth_failed");
    loginUrl.searchParams.set("error_description", "Authentication failed. Please try again.");
  }
  return NextResponse.redirect(loginUrl.toString());
}
