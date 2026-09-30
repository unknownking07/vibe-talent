import { ImageResponse } from "next/og";
import { ProfileSocialCard, SOCIAL_CARD_SIZE } from "@/components/share/social-card-image";
import { fetchUserByUsernameCached } from "@/lib/supabase/server-queries";
import { getShareCardLogo } from "@/lib/share-card-assets";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;
  const user = await fetchUserByUsernameCached(username);
  if (!user) return new Response("User not found", { status: 404 });
  const logoSrc = await getShareCardLogo(request.url);

  return new ImageResponse(<ProfileSocialCard user={user} logoSrc={logoSrc} />, {
    ...SOCIAL_CARD_SIZE,
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
