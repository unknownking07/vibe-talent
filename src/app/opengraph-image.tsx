import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "VibeTalent — Find Vibe Coders Who Actually Ship";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
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
            marginBottom: 12,
          }}
        >
          <span style={{ fontSize: 24, fontWeight: 800, color: "#FF3A00" }}>
            vibetalent.work
          </span>
        </div>

        {/* Main Card */}
        <div
          style={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            justifyContent: "center",
            backgroundColor: "#FFFFFF",
            border: "4px solid #0F0F0F",
            boxShadow: "12px 12px 0 #0F0F0F",
            padding: 60,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              marginBottom: 24,
            }}
          >
            <span style={{ fontSize: 48 }}>⚡</span>
            <span
              style={{
                fontSize: 56,
                fontWeight: 800,
                color: "#0F0F0F",
                textTransform: "uppercase",
                letterSpacing: "-1px",
              }}
            >
              VibeTalent
            </span>
          </div>

          <div
            style={{
              fontSize: 36,
              fontWeight: 800,
              color: "#0F0F0F",
              textTransform: "uppercase",
              lineHeight: 1.2,
            }}
          >
            Find Vibe Coders Who{" "}
            <span style={{ color: "#FF3A00" }}>Actually Ship.</span>
          </div>

          <p
            style={{
              fontSize: 22,
              color: "#52525B",
              marginTop: 20,
              lineHeight: 1.5,
            }}
          >
            A marketplace built on consistency and proof of work. No resumes.
            Just streaks, shipped projects, and vibe scores.
          </p>

          {/* Stats Row */}
          <div
            style={{
              display: "flex",
              gap: 24,
              marginTop: 36,
            }}
          >
            {[
              { icon: "🔥", label: "Streaks" },
              { icon: "📦", label: "Projects" },
              { icon: "🏆", label: "Badges" },
              { icon: "⚡", label: "Vibe Score" },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 20px",
                  backgroundColor: "#FFF7ED",
                  border: "3px solid #0F0F0F",
                }}
              >
                <span style={{ fontSize: 20 }}>{item.icon}</span>
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: "#0F0F0F",
                    textTransform: "uppercase",
                  }}
                >
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
