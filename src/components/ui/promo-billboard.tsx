import { unstable_cache } from "next/cache";
import { fetchPromotions, type EnrichedPromotion, type EnrichedProject, type EnrichedAuthor } from "@/lib/featured-promotions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PromoBillboardClient } from "./promo-billboard-client";

// Server wrapper: resolves the active on-chain promotions during SSR so the
// page paints with the right state on first byte. Without this, the client
// flashed an empty orange placeholder bar (36px) for ~500ms while the RPC +
// Supabase enrichment ran — visible on every refresh, even when there were
// no active promos and the bar should never have appeared at all.
//
// Cached for 60s across requests so we don't hit the Base RPC on every page
// view. Promotions change infrequently and the client-side timer still
// retires expired ones live without a refresh.
const getCachedPromos = unstable_cache(
  async (): Promise<EnrichedPromotion[]> => {
    try {
      const raw = await fetchPromotions();
      if (raw.length === 0) return [];

      const supabase = await createServerSupabaseClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;

      const projectIds = [...new Set(raw.map((p) => p.projectId))];
      const { data: projects } = await sb
        .from("projects")
        .select("id, title, description, tech_stack, live_url, github_url, image_url, verified, quality_score, endorsement_count, user_id")
        .in("id", projectIds);

      const projectMap = new Map<string, EnrichedProject & { user_id: string }>();
      for (const p of (projects ?? []) as Array<EnrichedProject & { user_id: string }>) {
        projectMap.set(p.id, p);
      }

      const userIds = [...new Set((projects ?? []).map((p: { user_id: string }) => p.user_id))];
      const { data: users } = await sb
        .from("users")
        .select("id, username, display_name, avatar_url, vibe_score, streak, badge_level")
        .in("id", userIds);

      const userMap = new Map<string, EnrichedAuthor>();
      for (const u of (users ?? []) as Array<EnrichedAuthor & { id: string }>) {
        userMap.set(u.id, u);
      }

      return raw.map((promo) => {
        const proj = projectMap.get(promo.projectId) ?? null;
        const author = proj ? userMap.get(proj.user_id) ?? null : null;
        return { ...promo, project: proj, author };
      });
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
