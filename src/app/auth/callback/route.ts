import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

// Map Supabase error codes to user-friendly messages
const ERROR_MESSAGES: Record<string, string> = {
  identity_already_exists:
    "This GitHub account is already linked to another VibeTalent account. Please sign in with that account instead, or use a different GitHub account.",
};

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  // Handle OAuth errors returned by Supabase (no code param present)
  const errorCode = searchParams.get("error_code");
  if (errorCode) {
    const message =
      ERROR_MESSAGES[errorCode] ||
      searchParams.get("error_description")?.replace(/\+/g, " ") ||
      "Authentication failed. Please try again.";
    return NextResponse.redirect(
      `${origin}/auth/login?error=${encodeURIComponent(message)}`
    );
  }

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

  return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent("Authentication failed. Please try again.")}`);
}
