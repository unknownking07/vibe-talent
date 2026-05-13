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

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: "#EAEBEA",
          backgroundImage:
            "radial-gradient(rgba(0,0,0,0.06) 2px, transparent 2px)",
          backgroundSize: "20px 20px",
          padding: "60px 80px",
          gap: "60px",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "32px",
            right: "60px",
            fontSize: 14,
            fontWeight: 900,
            letterSpacing: "0.12em",
            color: "#0F0F0F",
            display: "flex",
          }}
        >
          VIBE<span style={{ color: "#FF3A00", display: "flex" }}>TALENT</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 900,
              letterSpacing: "0.2em",
              color: "#0F0F0F",
              display: "flex",
            }}
          >
            VIBE SCORE
          </div>
          <div
            style={{
              fontSize: 220,
              fontWeight: 900,
              letterSpacing: "-0.04em",
              lineHeight: 0.9,
              color: "#FF3A00",
              textShadow: "4px 4px 0 #0F0F0F",
              display: "flex",
            }}
          >
            {user.vibe_score}
          </div>
          <div
            style={{
              display: "flex",
              gap: 10,
              marginTop: 30,
              alignItems: "center",
            }}
          >
            <span
              style={{
                background: "#0F0F0F",
                color: "#fff",
                padding: "8px 16px",
                fontSize: 22,
                fontWeight: 800,
                borderRadius: 4,
                display: "flex",
              }}
            >
              @{user.username}
            </span>
            <span
              style={{
                background: "#FF3A00",
                color: "#fff",
                padding: "6px 12px",
                fontSize: 18,
                fontWeight: 800,
                border: "2px solid #0F0F0F",
                borderRadius: 2,
                display: "flex",
              }}
            >
              🔥 streak {user.streak ?? 0}d
            </span>
          </div>
        </div>

        <div
          style={{
            background: "#fff",
            border: "3px solid #0F0F0F",
            boxShadow: "8px 8px 0 #0F0F0F",
            padding: 24,
            display: "flex",
            flexDirection: "column",
            gap: 10,
            minWidth: 280,
            borderRadius: 4,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 18,
              color: "#0F0F0F",
            }}
          >
            <span
              style={{
                fontFamily: "ui-monospace, Menlo, monospace",
                color: "#52525B",
                display: "flex",
              }}
            >
              badge
            </span>
            <span
              style={{
                fontFamily: "ui-monospace, Menlo, monospace",
                fontWeight: 800,
                color: "#FF3A00",
                fontSize: 22,
                display: "flex",
              }}
            >
              {(user.badge_level ?? "none").toUpperCase()}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 18,
              color: "#0F0F0F",
            }}
          >
            <span
              style={{
                fontFamily: "ui-monospace, Menlo, monospace",
                color: "#52525B",
                display: "flex",
              }}
            >
              longest streak
            </span>
            <span
              style={{
                fontFamily: "ui-monospace, Menlo, monospace",
                fontWeight: 800,
                color: "#FF3A00",
                fontSize: 22,
                display: "flex",
              }}
            >
              {user.longest_streak ?? 0}d
            </span>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
