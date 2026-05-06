import { cache } from "react";
import { createServerSupabaseClient } from "./server";

// React.cache memoizes within a single render tree — when both the navbar
// (root layout) and the hero CTA (homepage) call this in the same request,
// they share one Supabase round-trip instead of two. Keeps the SSR auth
// resolution cheap as more components opt into it.
export const getCurrentUser = cache(async () => {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
});
