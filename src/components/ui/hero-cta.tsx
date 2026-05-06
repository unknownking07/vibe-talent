import { getCurrentUser } from "@/lib/supabase/get-user";
import { HeroCTAClient } from "./hero-cta-client";

// Server wrapper: resolves auth at SSR time so the hero CTA renders with the
// correct label ("Go to Dashboard" vs "Create Your Profile") on first paint.
// `getCurrentUser` is React.cache'd, so the navbar's call earlier in the same
// render is reused — no extra Supabase round-trip on the homepage.
export async function HeroCTA(props: { className?: string; style?: React.CSSProperties }) {
  const user = await getCurrentUser();
  return <HeroCTAClient {...props} initialIsLoggedIn={!!user} />;
}
