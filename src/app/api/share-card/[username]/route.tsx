import { ImageResponse } from "next/og";
import { ProfileSocialCard, SOCIAL_CARD_SIZE } from "@/components/share/social-card-image";
import { fetchUserByUsernameCached } from "@/lib/supabase/server-queries";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;
  const user = await fetchUserByUsernameCached(username);
  if (!user) return new Response("User not found", { status: 404 });

  return new ImageResponse(<ProfileSocialCard user={user} />, {
    ...SOCIAL_CARD_SIZE,
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
