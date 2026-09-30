import { ImageResponse } from "next/og";
import { ProfileSocialCard, SOCIAL_CARD_SIZE } from "@/components/share/social-card-image";
import { fetchUserByUsernameCached } from "@/lib/supabase/server-queries";
import { getShareCardLogo } from "@/lib/share-card-assets";

export const alt = "VibeTalent builder profile";
export const size = SOCIAL_CARD_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const user = await fetchUserByUsernameCached(username);
  if (!user) return new Response("User not found", { status: 404 });
  const logoSrc = await getShareCardLogo();
  return new ImageResponse(<ProfileSocialCard user={user} logoSrc={logoSrc} />, SOCIAL_CARD_SIZE);
}
