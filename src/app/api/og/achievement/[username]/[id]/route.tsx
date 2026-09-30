import { ImageResponse } from "next/og";
import { fetchUserByUsernameCached } from "@/lib/supabase/server-queries";
import { fetchAchievementCounters } from "@/lib/achievements/fetch";
import { computeAchievements } from "@/lib/achievements/definitions";
import { getBadgeArt } from "@/lib/achievements/badge-art";
import { BadgeMedallion } from "@/components/achievements/badge-medallion";
import { AchievementSocialCard, SOCIAL_CARD_SIZE } from "@/components/share/social-card-image";
import { getShareCardLogo } from "@/lib/share-card-assets";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ username: string; id: string }> }) {
  const { username, id } = await params;
  const user = await fetchUserByUsernameCached(username);
  if (!user) return new Response("Not found", { status: 404 });

  const achievements = computeAchievements(await fetchAchievementCounters(user));
  const achievement = achievements.find((item) => item.id === id);
  if (!achievement) return new Response("Not found", { status: 404 });

  const art = getBadgeArt(id);
  const logoSrc = await getShareCardLogo(request.url);
  const cacheControl = achievement.earned
    ? "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400"
    : "public, max-age=60, s-maxage=60, stale-while-revalidate=120";

  return new ImageResponse(
    <AchievementSocialCard
      logoSrc={logoSrc}
      username={user.username}
      title={achievement.title}
      description={achievement.description}
      status={achievement.earned ? "Unlocked" : `${achievement.current} / ${achievement.threshold} ${achievement.unit}`}
      medallion={<BadgeMedallion paletteKey={art.palette} icon={art.icon} chipLabel={art.chipLabel} size={300} earned={achievement.earned} />}
    />,
    { ...SOCIAL_CARD_SIZE, headers: { "Cache-Control": cacheControl } },
  );
}
