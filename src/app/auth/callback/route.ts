import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

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

        const githubUsername =
          user.user_metadata?.user_name ||
          user.user_metadata?.preferred_username ||
          null;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: profile } = await (supabase as any)
          .from("users")
          .select("avatar_url, github_username")
          .eq("id", user.id)
          .single();

        if (profile) {
          const updates: Record<string, string> = {};

          if (oauthAvatar && !(profile as Record<string, unknown>).avatar_url) {
            updates.avatar_url = oauthAvatar;
          }

          if (githubUsername) {
            updates.github_username = githubUsername;
          }

          if (Object.keys(updates).length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase as any)
              .from("users")
              .update(updates)
              .eq("id", user.id);
          }
        }
      }

      return forwardedResponse;
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
}
