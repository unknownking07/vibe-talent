import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { fetchPromotions, enrichPromotions, type EnrichedPromotion } from "@/lib/featured-promotions";
import { PromoBillboardClient } from "./promo-billboard-client";

// Server wrapper: resolves the active on-chain promotions during SSR so the
// page paints with the right state on first byte. Without this, the client
// flashed an empty orange placeholder bar (36px) for ~500ms while the RPC +
// Supabase enrichment ran — visible on every refresh, even when there were
// no active promos and the bar should never have appeared at all.
//
// Cached for 60s across requests so we don't hit the Base RPC on every page
// view. We must NOT use the cookie-bound server Supabase client inside
// `unstable_cache` — Next.js disallows `cookies()` reads in cached scopes.
// The `projects`/`users` reads are public-data so the anon client is fine.
const getCachedPromos = unstable_cache(
  async (): Promise<EnrichedPromotion[]> => {
    try {
      const raw = await fetchPromotions();
      if (raw.length === 0) return [];
      const sb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      return await enrichPromotions(raw, sb);
    } catch {
      return [];
    }
  },
  ["promo-billboard-active"],
  { revalidate: 60 },
);

export async function PromoBillboard() {
  const promos = await getCachedPromos();
  if (promos.length === 0) return null;
  return <PromoBillboardClient initialPromos={promos} />;
}
