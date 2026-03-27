import { ImageResponse } from "next/og";
import { fetchUserByUsernameCached } from "@/lib/supabase/server-queries";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const user = await fetchUserByUsernameCached(username);

  if (!user) {
    return new Response("User not found", { status: 404 });
  }

  const allTech = user.projects.flatMap((p) => p.tech_stack);
  const techCounts = allTech.reduce((acc, t) => {
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const topTech = Object.entries(techCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([t]) => t.toUpperCase());

  const initial = user.username.slice(0, 1).toUpperCase();
  const avatarSrc = user.avatar_url;
  const bio = user.bio
    ? (user.bio.length > 30 ? user.bio.slice(0, 30) + "..." : user.bio)
    : "vibecoder";
  const streakStr = String(user.streak).padStart(2, "0");
  const longestStr = String(user.longest_streak).padStart(2, "0");
  const projectsStr = String(user.projects.length).padStart(2, "0");
  const terminalId = username.toUpperCase().slice(0, 10);

  const BG = "#646cff";
  const CARD = "#eae9e4";
  const ACCENT = "#ff5b22";
  const TEXT = "#1c1c1c";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: BG,
          fontFamily: "system-ui, sans-serif",
          overflow: "hidden",
        }}
      >
        {/* Top sys bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            height: 40,
            padding: "0 40px",
            fontSize: 10,
            fontWeight: 500,
            color: TEXT,
            letterSpacing: "3px",
            textTransform: "uppercase",
          }}
        >
          <span>{`[ SYS.OP.RDY ] // TERMINAL_ID: ${terminalId}`}</span>
          <span style={{ opacity: 0.7 }}>DATA_STREAM REC</span>
          <span style={{ opacity: 0.7 }}>W:1200 H:630</span>
        </div>

        {/* Main content */}
        <div
          style={{
            display: "flex",
            flex: 1,
            padding: "0 32px 32px 32px",
            gap: 24,
          }}
        >
          {/* LEFT PANEL - Vibe Score */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: "45%",
              backgroundColor: CARD,
              borderRadius: 48,
              padding: "48px",
              position: "relative",
              justifyContent: "space-between",
              overflow: "hidden",
            }}
          >
            {/* Score header */}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span
                style={{
                  fontSize: 28,
                  fontWeight: 300,
                  color: TEXT,
                  letterSpacing: "8px",
                  textTransform: "uppercase",
                }}
              >
                VIBE SCORE
              </span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 400,
                  color: "rgba(28,28,28,0.45)",
                  letterSpacing: "4px",
                  textTransform: "uppercase",
                  marginTop: 8,
                }}
              >
                GLOBAL_INDEX_RANK
              </span>
            </div>

            {/* Big score number - centered */}
            <div
              style={{
                display: "flex",
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span
                style={{
                  fontSize: 300,
                  fontWeight: 200,
                  color: TEXT,
                  lineHeight: 0.75,
                  letterSpacing: "-12px",
                }}
              >
                {String(user.vibe_score)}
              </span>
            </div>

            {/* vibetalent.work pill */}
            <div style={{ display: "flex" }}>
              <div
                style={{
                  display: "flex",
                  backgroundColor: "#FF4500",
                  color: "#FFFFFF",
                  padding: "14px 28px",
                  fontSize: 16,
                  fontWeight: 500,
                  borderRadius: 999,
                  letterSpacing: "3px",
                  textTransform: "uppercase",
                  transform: "rotate(-3deg)",
                }}
              >
                vibetalent.work
              </div>
            </div>
          </div>

          {/* RIGHT PANEL */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: "55%",
              gap: 24,
            }}
          >
            {/* Profile card */}
            <div
              style={{
                display: "flex",
                backgroundColor: CARD,
                borderRadius: 48,
                padding: "32px 40px",
                alignItems: "center",
                gap: 32,
                height: 160,
              }}
            >
              {/* Avatar circle */}
              <div
                style={{
                  display: "flex",
                  width: 96,
                  height: 96,
                  borderRadius: "50%",
                  backgroundColor: ACCENT,
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 40,
                  fontWeight: 300,
                  color: "#FFFFFF",
                  overflow: "hidden",
                  flexShrink: 0,
                }}
              >
                {avatarSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarSrc}
                    alt=""
                    width={96}
                    height={96}
                    style={{
                      width: 96,
                      height: 96,
                      objectFit: "cover",
                      borderRadius: "50%",
                    }}
                  />
                ) : (
                  initial
                )}
              </div>

              {/* Name + badge */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <span
                  style={{
                    fontSize: 42,
                    fontWeight: 300,
                    color: TEXT,
                    textTransform: "uppercase",
                    letterSpacing: "4px",
                    lineHeight: 1,
                  }}
                >
                  @{user.username}
                </span>
                <div
                  style={{
                    display: "flex",
                    fontSize: 11,
                    fontWeight: 500,
                    color: TEXT,
                    border: "1px solid rgba(28,28,28,0.2)",
                    padding: "6px 16px",
                    borderRadius: 999,
                    letterSpacing: "3px",
                    textTransform: "uppercase",
                  }}
                >
                  {bio}
                </div>
              </div>
            </div>

            {/* Stats 2x2 grid using flexbox */}
            <div
              style={{
                display: "flex",
                flex: 1,
                gap: 24,
              }}
            >
              {/* Col 1 */}
              <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 24 }}>
                {/* 01 Streak */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                    backgroundColor: ACCENT,
                    borderRadius: 40,
                    padding: "28px 32px",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 16, fontWeight: 500, color: TEXT, letterSpacing: "3px" }}>01</span>
                    <span style={{ fontSize: 16, fontWeight: 300, color: TEXT, letterSpacing: "3px", textTransform: "uppercase" }}>Streak</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <span style={{ fontSize: 80, fontWeight: 200, color: TEXT, lineHeight: 0.8, letterSpacing: "-4px" }}>{streakStr}</span>
                  </div>
                </div>

                {/* 03 Shipped */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                    backgroundColor: ACCENT,
                    borderRadius: 40,
                    padding: "28px 32px",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 16, fontWeight: 500, color: TEXT, letterSpacing: "3px" }}>03</span>
                    <span style={{ fontSize: 16, fontWeight: 300, color: TEXT, letterSpacing: "3px", textTransform: "uppercase" }}>Shipped</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <span style={{ fontSize: 80, fontWeight: 200, color: TEXT, lineHeight: 0.8, letterSpacing: "-4px" }}>{projectsStr}</span>
                  </div>
                </div>
              </div>

              {/* Col 2 */}
              <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 24 }}>
                {/* 02 Max Streak */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                    backgroundColor: ACCENT,
                    borderRadius: 40,
                    padding: "28px 32px",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 16, fontWeight: 500, color: TEXT, letterSpacing: "3px" }}>02</span>
                    <span style={{ fontSize: 16, fontWeight: 300, color: TEXT, letterSpacing: "3px", textTransform: "uppercase" }}>Max Streak</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <span style={{ fontSize: 80, fontWeight: 200, color: TEXT, lineHeight: 0.8, letterSpacing: "-4px" }}>{longestStr}</span>
                  </div>
                </div>

                {/* 04 Stack */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                    backgroundColor: ACCENT,
                    borderRadius: 40,
                    padding: "28px 32px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                    <span style={{ fontSize: 16, fontWeight: 500, color: TEXT, letterSpacing: "3px" }}>04</span>
                    <span style={{ fontSize: 16, fontWeight: 300, color: TEXT, letterSpacing: "3px", textTransform: "uppercase" }}>Stack</span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: "auto" }}>
                    {topTech.length > 0 ? topTech.map((tech) => (
                      <span
                        key={tech}
                        style={{
                          fontSize: 11,
                          fontWeight: 500,
                          color: TEXT,
                          backgroundColor: CARD,
                          padding: "8px 16px",
                          borderRadius: 999,
                          letterSpacing: "2px",
                        }}
                      >
                        {tech}
                      </span>
                    )) : (
                      <span style={{ fontSize: 11, color: "rgba(28,28,28,0.5)", letterSpacing: "2px" }}>NO PROJECTS</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
