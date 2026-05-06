import { createServerSupabaseClient } from "@/lib/supabase/server";
import { HeroCTAClient } from "./hero-cta-client";

// Server wrapper: resolves auth at SSR time so the hero CTA renders with the
// correct label ("Go to Dashboard" vs "Create Your Profile") on first paint.
export async function HeroCTA(props: { className?: string; style?: React.CSSProperties }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  return <HeroCTAClient {...props} initialIsLoggedIn={!!user} />;
}
