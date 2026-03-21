import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Pull avatar from OAuth provider if user doesn't have one
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const oauthAvatar =
          user.user_metadata?.avatar_url ||
          user.user_metadata?.picture ||
          null;

        // Extract GitHub username from OAuth metadata
        // GitHub provides this as user_name or preferred_username
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
          // Build update object with fields that need updating
          const updates: Record<string, string> = {};

          if (oauthAvatar && !(profile as Record<string, unknown>).avatar_url) {
            updates.avatar_url = oauthAvatar;
          }

          // Always update github_username from OAuth metadata on login
          // NOTE: If the `github_username` column doesn't exist yet, run:
          // ALTER TABLE users ADD COLUMN IF NOT EXISTS github_username TEXT;
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

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
}
