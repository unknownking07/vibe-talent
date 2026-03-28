import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const BADGE_COLORS: Record<string, { bg: string; accent: string }> = {
  diamond: { bg: "#0E7490", accent: "#67E8F9" },
  gold: { bg: "#A16207", accent: "#FDE68A" },
  silver: { bg: "#52525B", accent: "#D4D4D8" },
  bronze: { bg: "#B45309", accent: "#FCD34D" },
  none: { bg: "#0F0F0F", accent: "#FF3A00" },
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

  if (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  if (!user) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="28" viewBox="0 0 220 28">
      <rect width="220" height="28" rx="4" fill="#0F0F0F"/>
      <text x="110" y="18" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" font-weight="600" fill="#FFFFFF">VibeTalent — User not found</text>
    </svg>`;
    return new NextResponse(svg, {
      status: 404,
      headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=300" },
    });
  }

  const colors = BADGE_COLORS[user.badge_level] || BADGE_COLORS.none;
  const badgeLabel = user.badge_level !== "none"
    ? user.badge_level.charAt(0).toUpperCase() + user.badge_level.slice(1)
    : null;

  // Section widths
  const brandW = 82;
  const userW = Math.max(user.username.length * 7 + 24, 70);
  const streakW = 72;
  const scoreW = 64;
  const badgeW = badgeLabel ? badgeLabel.length * 7 + 20 : 0;
  const gap = 1;
  const totalW = brandW + gap + userW + gap + streakW + gap + scoreW + (badgeLabel ? gap + badgeW : 0);
  const h = 28;

  const brandX = 0;
  const userX = brandW + gap;
  const streakX = userX + userW + gap;
  const scoreX = streakX + streakW + gap;
  const badgeX = scoreX + scoreW + gap;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${h}" viewBox="0 0 ${totalW} ${h}">
    <clipPath id="rounded"><rect width="${totalW}" height="${h}" rx="4"/></clipPath>
    <g clip-path="url(#rounded)">
      <!-- Brand -->
      <rect x="${brandX}" y="0" width="${brandW}" height="${h}" fill="${colors.accent}"/>
      <text x="${brandX + brandW / 2}" y="18" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" font-weight="700" fill="${colors.bg}">VibeTalent</text>

      <!-- Username -->
      <rect x="${userX}" y="0" width="${userW}" height="${h}" fill="${colors.bg}"/>
      <text x="${userX + userW / 2}" y="18" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" font-weight="600" fill="#FFFFFF">@${escapeXml(user.username)}</text>

      <!-- Streak -->
      <rect x="${streakX}" y="0" width="${streakW}" height="${h}" fill="#1A1A1A"/>
      <text x="${streakX + streakW / 2}" y="18" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" font-weight="600" fill="${colors.accent}">${user.streak}d streak</text>

      <!-- Vibe Score -->
      <rect x="${scoreX}" y="0" width="${scoreW}" height="${h}" fill="${colors.bg}"/>
      <text x="${scoreX + scoreW / 2}" y="18" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" font-weight="600" fill="${colors.accent}">${user.vibe_score} vibe</text>

      ${badgeLabel ? `
      <!-- Badge Level -->
      <rect x="${badgeX}" y="0" width="${badgeW}" height="${h}" fill="${colors.accent}"/>
      <text x="${badgeX + badgeW / 2}" y="18" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" font-weight="700" fill="${colors.bg}">${badgeLabel}</text>
      ` : ""}
    </g>
  </svg>`;

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
