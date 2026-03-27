import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const BADGE_COLORS: Record<string, { bg: string; accent: string; text: string }> = {
  diamond: { bg: "#0E7490", accent: "#CFFAFE", text: "#FFFFFF" },
  gold: { bg: "#A16207", accent: "#FEF9C3", text: "#FFFFFF" },
  silver: { bg: "#52525B", accent: "#F4F4F5", text: "#FFFFFF" },
  bronze: { bg: "#B45309", accent: "#FEF3C7", text: "#FFFFFF" },
  none: { bg: "#0F0F0F", accent: "#FF3A00", text: "#FFFFFF" },
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: user, error } = await (supabase as any)
    .from("users")
    .select("username, streak, vibe_score, badge_level")
    .eq("username", username)
    .single();

  if (error || !user) {
    // Return a "not found" badge
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="280" height="36" viewBox="0 0 280 36">
      <rect width="280" height="36" rx="4" fill="#0F0F0F"/>
      <text x="140" y="22" text-anchor="middle" font-family="sans-serif" font-size="12" font-weight="bold" fill="#FFFFFF">VibeTalent: User not found</text>
    </svg>`;
    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=300",
      },
    });
  }

  const colors = BADGE_COLORS[user.badge_level] || BADGE_COLORS.none;
  const badgeLabel = user.badge_level !== "none" ? user.badge_level.charAt(0).toUpperCase() + user.badge_level.slice(1) : "";

  // Badge dimensions
  const width = 340;
  const height = 36;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700&amp;display=swap');
        text { font-family: 'Space Grotesk', sans-serif; }
      </style>
    </defs>
    <!-- Background -->
    <rect width="${width}" height="${height}" rx="4" fill="${colors.bg}"/>

    <!-- VibeTalent brand -->
    <rect x="0" y="0" width="90" height="${height}" rx="4" fill="${colors.accent}"/>
    <rect x="4" y="0" width="86" height="${height}" fill="${colors.accent}"/>
    <text x="12" y="23" font-size="11" font-weight="700" fill="${colors.bg}" letter-spacing="0.5">⚡ VibeTalent</text>

    <!-- Username -->
    <text x="100" y="23" font-size="12" font-weight="700" fill="${colors.text}">@${user.username}</text>

    <!-- Streak -->
    <text x="200" y="23" font-size="11" font-weight="700" fill="${colors.accent}">🔥 ${user.streak}d</text>

    <!-- Vibe Score -->
    <text x="250" y="23" font-size="11" font-weight="700" fill="${colors.accent}">⚡ ${user.vibe_score}</text>

    ${badgeLabel ? `<!-- Badge -->
    <text x="300" y="23" font-size="11" font-weight="700" fill="${colors.accent}">${badgeLabel}</text>` : ""}
  </svg>`;

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
