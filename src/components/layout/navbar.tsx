import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/get-user";
import { NavbarClient, type NavbarProfile } from "./navbar-client";

// Server wrapper: resolves auth + profile during SSR so the navbar paints in
// the right state on first byte. Without this, the client component flashed
// the logged-out CTA (and a "??" avatar) for a frame on every refresh while
// it waited for `getUser()` to round-trip.
//
// `getCurrentUser` is React.cache'd — when the homepage's HeroCTA also calls
// it during the same render, they share one Supabase round-trip instead of
// duplicating the request.
export async function Navbar() {
  const user = await getCurrentUser();

  let initialProfile: NavbarProfile | null = null;
  if (user) {
    const supabase = await createServerSupabaseClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const { data: profile } = await sb
      .from("users")
      .select("username, avatar_url, github_username, display_name")
      .eq("id", user.id)
      .single();
    if (profile?.username) {
      initialProfile = {
        username: profile.username,
        avatar_url: profile.avatar_url ?? null,
        github_username: profile.github_username ?? null,
        display_name: profile.display_name ?? null,
      };
    } else if (user.email) {
      // Mirror the client-side fallback: an authenticated user without a
      // `users` row still gets an avatar (initials) instead of "??".
      initialProfile = {
        username: user.email.split("@")[0],
        avatar_url: null,
        github_username: null,
        display_name: null,
      };
    }
  }

  return <NavbarClient initialIsLoggedIn={!!user} initialProfile={initialProfile} />;
}
