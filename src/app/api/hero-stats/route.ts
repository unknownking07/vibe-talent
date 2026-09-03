import { NextRequest, NextResponse } from "next/server";
import { statsLimiter, checkRateLimit, getIP } from "@/lib/rate-limit";
import { fetchHeroStatsCached } from "@/lib/supabase/server-queries";

/**
 * Live figures for the homepage stat strip (`ProofWallStats`).
 *
 * The strip is server-rendered from the same numbers on first paint and then
 * polls this every 60s, so a new signup lands on the page without a refresh.
 * Anonymous and aggregate-only — nothing here identifies a builder — so it
 * stays publicly cacheable.
 */
export async function GET(request: NextRequest) {
  const { success } = await checkRateLimit(statsLimiter, getIP(request));
  if (!success) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  try {
    const stats = await fetchHeroStatsCached();
    return NextResponse.json(stats, {
      headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" },
    });
  } catch (err) {
    console.error("[hero-stats] fetch failed:", err);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
