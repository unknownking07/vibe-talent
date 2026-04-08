import { ImageResponse } from "next/og";
import { fetchUserByUsernameCached } from "@/lib/supabase/server-queries";

export const runtime = "edge";
export const alt = "VibeTalent Profile";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const user = await fetchUserByUsernameCached(username);

  if (!user) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#EAEBEA",
            fontFamily: "sans-serif",
          }}
        >
          <div style={{ fontSize: 48, fontWeight: 800, color: "#0F0F0F" }}>
            Builder Not Found
          </div>
        </div>
      ),
      { ...size }
    );
  }

  const badgeLabel =
    user.badge_level === "diamond"
      ? "DIAMOND"
      : user.badge_level === "gold"
        ? "GOLD"
        : user.badge_level === "silver"
          ? "SILVER"
          : user.badge_level === "bronze"
            ? "BRONZE"
            : "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#EAEBEA",
          fontFamily: "sans-serif",
          padding: 60,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              backgroundColor: "#FF3A00",
              border: "2px solid #0F0F0F",
              color: "#FFFFFF",
              fontSize: 16,
              fontWeight: 800,
            }}
          >
            V
          </div>
          <span style={{ fontSize: 24, fontWeight: 800, color: "#FF3A00" }}>
            VibeTalent
          </span>
        </div>

        {/* Main Card — no boxShadow (unsupported by Satori) */}
        <div
          style={{
            display: "flex",
            flex: 1,
            backgroundColor: "#FFFFFF",
            border: "4px solid #0F0F0F",
            padding: 48,
            gap: 48,
          }}
        >
          {/* Avatar */}
          <div
            style={{
              width: 160,
              height: 160,
              backgroundColor: "#0F0F0F",
              border: "4px solid #0F0F0F",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 56,
              fontWeight: 800,
              color: "#FFFFFF",
              flexShrink: 0,
            }}
          >
            {user.username.slice(0, 2).toUpperCase()}
          </div>

          {/* Info */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              flex: 1,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <span
                style={{
                  fontSize: 48,
                  fontWeight: 800,
                  color: "#0F0F0F",
                  textTransform: "uppercase",
                }}
              >
                {user.display_name || `@${user.username}`}
              </span>
              {user.github_username && (
                <svg
                  width="44"
                  height="44"
                  viewBox="0 0 24 24"
                  fill="#1D9BF0"
                  stroke="#FFFFFF"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" />
                  <path d="m9 12 2 2 4-4" stroke="#FFFFFF" />
                </svg>
              )}
              {badgeLabel && (
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    color: "#CA8A04",
                    backgroundColor: "#FFF7ED",
                    border: "2px solid #0F0F0F",
                    padding: "4px 12px",
                    textTransform: "uppercase",
                  }}
                >
                  {badgeLabel}
                </span>
              )}
            </div>
            {user.display_name && (
              <span style={{ fontSize: 24, color: "#71717A", fontWeight: 500 }}>
                @{user.username}
              </span>
            )}
            </div>

            {user.bio && (
              <p
                style={{
                  fontSize: 22,
                  color: "#52525B",
                  marginTop: 8,
                }}
              >
                {user.bio.slice(0, 100)}
                {user.bio.length > 100 ? "..." : ""}
              </p>
            )}

            {/* Stats */}
            <div
              style={{
                display: "flex",
                gap: 32,
                marginTop: 32,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  padding: "16px 24px",
                  backgroundColor: "#FFF7ED",
                  border: "3px solid #0F0F0F",
                }}
              >
                <span
                  style={{ fontSize: 36, fontWeight: 800, color: "#FF3A00" }}
                >
                  {user.streak}
                </span>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: "#71717A",
                    textTransform: "uppercase",
                  }}
                >
                  Day Streak
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  padding: "16px 24px",
                  backgroundColor: "#FFF7ED",
                  border: "3px solid #0F0F0F",
                }}
              >
                <span
                  style={{ fontSize: 36, fontWeight: 800, color: "#FF3A00" }}
                >
                  {user.vibe_score}
                </span>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: "#71717A",
                    textTransform: "uppercase",
                  }}
                >
                  Vibe Score
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  padding: "16px 24px",
                  backgroundColor: "#F5F5F5",
                  border: "3px solid #0F0F0F",
                }}
              >
                <span
                  style={{ fontSize: 36, fontWeight: 800, color: "#0F0F0F" }}
                >
                  {(user.projects ?? []).length}
                </span>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: "#71717A",
                    textTransform: "uppercase",
                  }}
                >
                  Projects
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
