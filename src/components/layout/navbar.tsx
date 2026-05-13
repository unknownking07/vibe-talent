import { NavbarClient } from "./navbar-client";

// Render the navbar with a logged-out initial state and let NavbarClient
// resolve auth client-side after hydration. The previous version called
// `getCurrentUser()` (which reads cookies via the Supabase server client)
// during SSR — that single call marked every page in the root layout as
// dynamic, silently disabling ISR on `/`, `/explore`, `/leaderboard`, etc.
// and forcing every request through the Vercel origin in iad1.
//
// Tradeoff: logged-in users see the logged-out CTA briefly during the
// client-side getUser() round-trip on a hard refresh. NavbarClient handles
// the post-hydration state swap (see useEffect calling supabase.auth.getUser).
export function Navbar() {
  return <NavbarClient initialIsLoggedIn={false} initialProfile={null} />;
}
