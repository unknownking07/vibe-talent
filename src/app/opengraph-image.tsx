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
            marginBottom: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 36,
              height: 36,
              backgroundColor: "#FF3A00",
              border: "2px solid #0F0F0F",
              color: "#FFFFFF",
              fontSize: 18,
            }}
          >
            V
          </div>
          <span style={{ fontSize: 24, fontWeight: 800, color: "#FF3A00" }}>
            vibetalent.work
          </span>
        </div>

        {/* Main Card — no boxShadow (unsupported by Satori), use border only */}
        <div
          style={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            justifyContent: "center",
            backgroundColor: "#FFFFFF",
            border: "4px solid #0F0F0F",
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
              display: "flex",
            }}
          >
            Find Vibe Coders Who&nbsp;
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
            The marketplace built on consistency and proof of work. Streaks,
            shipped projects, and vibe scores.
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
              { label: "Streaks", color: "#FF3A00" },
              { label: "Projects", color: "#0F0F0F" },
              { label: "Badges", color: "#CA8A04" },
              { label: "Vibe Score", color: "#FF3A00" },
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
                <div
                  style={{
                    width: 10,
                    height: 10,
                    backgroundColor: item.color,
                    borderRadius: "50%",
                  }}
                />
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
