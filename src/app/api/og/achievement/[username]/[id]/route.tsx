import { ImageResponse } from "next/og";
import { fetchUserByUsernameCached } from "@/lib/supabase/server-queries";
import { fetchAchievementCounters } from "@/lib/achievements/fetch";
import { computeAchievements } from "@/lib/achievements/definitions";
import { getBadgeArt, PALETTES } from "@/lib/achievements/badge-art";
import { BadgeMedallion } from "@/components/achievements/badge-medallion";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ username: string; id: string }> },
) {
  const { username, id } = await ctx.params;

  const user = await fetchUserByUsernameCached(username);
  if (!user) {
    return new Response("Not Found", { status: 404 });
  }

  const counters = await fetchAchievementCounters(user);
  const achievements = computeAchievements(counters);
  const achievement = achievements.find((a) => a.id === id);
  if (!achievement) {
    return new Response("Not Found", { status: 404 });
  }

  const art = getBadgeArt(id);
  const palette = PALETTES[art.palette];
  const statusLabel = achievement.earned ? "UNLOCKED" : "IN PROGRESS";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0F0F0F",
          padding: 50,
          fontFamily: "ui-monospace, Menlo, monospace",
        }}
      >
        <div
          style={{
            background: "#FFFFFF",
            color: "#0F0F0F",
            padding: "48px 56px",
            width: "88%",
            height: "82%",
            boxShadow: "14px 14px 0 #FF3A00",
            display: "flex",
            flexDirection: "column",
            border: "3px solid #0F0F0F",
          }}
        >
          {/* Header row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "3px dashed #0F0F0F",
              paddingBottom: 20,
              marginBottom: 28,
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 18,
                fontWeight: 900,
                letterSpacing: "0.18em",
              }}
            >
              VIBE
              <span style={{ display: "flex", color: "#FF3A00" }}>TALENT</span>
              <span style={{ display: "flex", color: "#A1A1AA", marginLeft: 12 }}>
                / ACHIEVEMENT
              </span>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "6px 14px",
                background: achievement.earned ? "#DCFCE7" : "#F4F4F5",
                color: achievement.earned ? "#166534" : "#52525B",
                border: "2px solid #0F0F0F",
                fontSize: 16,
                fontWeight: 900,
                letterSpacing: "0.12em",
              }}
            >
              {statusLabel}
            </div>
          </div>

          {/* Body */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 56,
              flex: 1,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 340,
                height: 340,
                flexShrink: 0,
              }}
            >
              <BadgeMedallion
                paletteKey={art.palette}
                icon={art.icon}
                chipLabel={art.chipLabel}
                size={300}
                earned={achievement.earned}
              />
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                minWidth: 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontSize: 22,
                  fontWeight: 900,
                  letterSpacing: "0.18em",
                  color: palette.ring,
                  marginBottom: 8,
                }}
              >
                {achievement.category.toUpperCase()}
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 64,
                  fontWeight: 900,
                  letterSpacing: "-0.02em",
                  lineHeight: 1.05,
                  color: "#0F0F0F",
                  marginBottom: 16,
                }}
              >
                {achievement.title}
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 26,
                  fontWeight: 500,
                  lineHeight: 1.35,
                  color: "#3F3F46",
                  marginBottom: 28,
                }}
              >
                {achievement.description}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  paddingTop: 18,
                  borderTop: "3px dashed #0F0F0F",
                }}
              >
                <Avatar user={user} size={64} />
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      fontSize: 26,
                      fontWeight: 900,
                      color: "#0F0F0F",
                    }}
                  >
                    @{user.username}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      fontSize: 16,
                      fontWeight: 700,
                      color: "#71717A",
                      letterSpacing: "0.06em",
                    }}
                  >
                    {achievement.earned
                      ? "EARNED ON VIBETALENT"
                      : `${achievement.current} / ${achievement.threshold} ${achievement.unit.toUpperCase()}`}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}

/**
 * Validate that an avatar URL is safe for server-side fetch in next/og.
 *
 * Defense-in-depth against SSRF: parse via URL, require https, and reject
 * obvious localhost / private-network hostnames. Does not protect against
 * DNS rebinding — for full coverage we'd need to resolve and check IP.
 */
function isSafeAvatarUrl(raw: unknown): raw is string {
  if (typeof raw !== "string" || raw.length === 0) return false;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  const host = parsed.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host.endsWith(".localhost") ||
    host.endsWith(".internal") ||
    host.endsWith(".local")
  ) {
    return false;
  }
  // Reject obvious private/loopback IP literals.
  if (/^127\./.test(host)) return false;
  if (/^10\./.test(host)) return false;
  if (/^192\.168\./.test(host)) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
  if (/^169\.254\./.test(host)) return false; // link-local
  if (host === "::1" || host.startsWith("[::1") || host.startsWith("fc") || host.startsWith("fd")) {
    return false;
  }
  return true;
}

function Avatar({
  user,
  size,
}: {
  user: { username: string; avatar_url: string | null };
  size: number;
}) {
  const url = user.avatar_url;
  const valid = isSafeAvatarUrl(url);
  if (valid) {
    return (
      <div
        style={{
          display: "flex",
          width: size,
          height: size,
          borderRadius: "50%",
          overflow: "hidden",
          border: "2.5px solid #0F0F0F",
          flexShrink: 0,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          width={size}
          height={size}
          alt=""
          style={{
            display: "flex",
            objectFit: "cover",
            width: size,
            height: size,
          }}
        />
      </div>
    );
  }
  return (
    <div
      style={{
        display: "flex",
        width: size,
        height: size,
        borderRadius: "50%",
        border: "2.5px solid #0F0F0F",
        background: "linear-gradient(135deg, #FF3A00, #FFA07A)",
        color: "#fff",
        fontWeight: 900,
        fontSize: size * 0.42,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {(user.username[0] ?? "?").toUpperCase()}
    </div>
  );
}
