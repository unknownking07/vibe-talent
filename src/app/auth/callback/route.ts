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

        if (oauthAvatar) {
          // Check if user already has an avatar
          const { data: profile } = await supabase
            .from("users")
            .select("avatar_url")
            .eq("id", user.id)
            .single();

          if (profile && !profile.avatar_url) {
            await supabase
              .from("users")
              .update({ avatar_url: oauthAvatar })
              .eq("id", user.id);
          }
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
}
