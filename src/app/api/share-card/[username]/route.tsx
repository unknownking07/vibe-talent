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

  const badgeLabel =
    user.badge_level === "diamond" ? "DIAMOND" :
    user.badge_level === "gold" ? "GOLD" :
    user.badge_level === "silver" ? "SILVER" :
    user.badge_level === "bronze" ? "BRONZE" : null;

  const badgeColor =
    user.badge_level === "diamond" ? "#0891B2" :
    user.badge_level === "gold" ? "#CA8A04" :
    user.badge_level === "silver" ? "#A1A1AA" :
    user.badge_level === "bronze" ? "#D97706" : "#333";

  const allTech = user.projects.flatMap((p) => p.tech_stack);
  const techCounts = allTech.reduce((acc, t) => {
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const topTech = Object.entries(techCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([t]) => t.toUpperCase());

  const initials = user.username.slice(0, 2).toUpperCase();
  const avatarSrc = user.avatar_url;
  const bio = user.bio
    ? (user.bio.length > 35 ? user.bio.slice(0, 35) + "..." : user.bio)
    : "Vibe Coder";
  const streakStr = String(user.streak).padStart(2, "0");
  const longestStr = String(user.longest_streak).padStart(2, "0");
  const projectsStr = String(user.projects.length).padStart(2, "0");
  const terminalId = username.toUpperCase().slice(0, 10);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#0F0F0F",
          color: "#FFFFFF",
          border: "6px solid #FFFFFF",
          fontFamily: "monospace",
          overflow: "hidden",
        }}
      >
        {/* ═══ SYS BAR ═══ */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            height: 40,
            padding: "0 24px",
            backgroundColor: "#FFFFFF",
            color: "#0F0F0F",
            fontSize: 14,
            fontWeight: 700,
            borderBottom: "6px solid #FFFFFF",
          }}
        >
          <span>{`[ SYS.OP.RDY ] // TERMINAL_ID: ${terminalId}`}</span>
          <span>{`DATA_STREAM REC`}</span>
          <span>{`W:1200 H:630`}</span>
        </div>

        {/* ═══ MAIN CONTENT ═══ */}
        <div style={{ display: "flex", flex: 1 }}>

          {/* ─── LEFT PANEL: SCORE ─── */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: "45%",
              borderRight: "6px solid #FFFFFF",
              justifyContent: "center",
              alignItems: "center",
              padding: 40,
              position: "relative",
            }}
          >
            {/* Label top-left */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                position: "absolute",
                top: 40,
                left: 40,
                gap: 4,
              }}
            >
              <span
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: "#FF3A00",
                  letterSpacing: "2px",
                }}
              >
                {`VIBE SCORE`}
              </span>
              <span style={{ fontSize: 12, color: "#888", letterSpacing: "1px" }}>
                {`GLOBAL_INDEX_RANK`}
              </span>
            </div>

            {/* Hero score — matching 340px with layered shadow */}
            <span
              style={{
                fontSize: 320,
                fontWeight: 900,
                color: "#FFFFFF",
                lineHeight: 0.8,
                textShadow:
                  "6px 6px 0 #FF3A00, 12px 12px 0 #FF3A00, 18px 18px 0 #0F0F0F, 24px 24px 0 #FFFFFF",
                transform: "rotate(-4deg)",
                marginTop: 20,
              }}
            >
              {String(user.vibe_score)}
            </span>

            {/* Branding bottom-left */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                position: "absolute",
                bottom: 40,
                left: 40,
                backgroundColor: "#FF3A00",
                color: "#0F0F0F",
                padding: "8px 16px",
                border: "4px solid #FFFFFF",
                boxShadow: "6px 6px 0 #FFFFFF",
                fontSize: 18,
                fontWeight: 900,
                letterSpacing: "1px",
              }}
            >
              <span>{`vibetalent.work`}</span>
            </div>
          </div>

          {/* ─── RIGHT PANEL ─── */}
          <div style={{ display: "flex", flexDirection: "column", width: "55%" }}>

            {/* ─── PROFILE BLOCK ─── */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                height: 180,
                padding: "0 40px",
                borderBottom: "6px solid #FFFFFF",
                backgroundColor: "#141414",
              }}
            >
              {/* Avatar — square, NO grayscale, with orange shadow */}
              <div
                style={{
                  display: "flex",
                  width: 100,
                  height: 100,
                  border: "6px solid #FFFFFF",
                  boxShadow: "8px 8px 0 #FF3A00",
                  backgroundColor: "#FF3A00",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 36,
                  fontWeight: 900,
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
                    width={100}
                    height={100}
                    style={{ width: 100, height: 100, objectFit: "cover" }}
                  />
                ) : (
                  initials
                )}
              </div>

              {/* Profile info */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  marginLeft: 40,
                  flex: 1,
                  gap: 12,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "space-between",
                  }}
                >
                  <span
                    style={{
                      fontSize: 36,
                      fontWeight: 900,
                      color: "#FFFFFF",
                      lineHeight: 1,
                      textShadow: "4px 4px 0 #FF3A00",
                      textTransform: "uppercase",
                    }}
                  >
                    {`@${user.username}`}
                  </span>
                  {badgeLabel && (
                    <span
                      style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: "#0F0F0F",
                        backgroundColor: badgeColor,
                        border: "3px solid #FFFFFF",
                        padding: "6px 12px",
                        boxShadow: "4px 4px 0 #FFFFFF",
                        letterSpacing: "1px",
                      }}
                    >
                      {badgeLabel}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <span
                    style={{
                      fontSize: 18,
                      color: "#DDD",
                      backgroundColor: "#222",
                      padding: "6px 12px",
                      borderLeft: "4px solid #FF3A00",
                    }}
                  >
                    {bio}
                  </span>
                </div>
              </div>
            </div>

            {/* ─── STATS GRID 2x2 ─── */}
            <div style={{ display: "flex", flex: 1 }}>
              {/* Col 1 */}
              <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                {/* 01 STREAK */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                    padding: 30,
                    borderBottom: "6px solid #FFFFFF",
                    borderRight: "6px solid #FFFFFF",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                    <span style={{ fontSize: 28, fontWeight: 900, color: "#FF3A00", lineHeight: 1 }}>{`01`}</span>
                    <span style={{ fontSize: 20, fontWeight: 900, color: "#FFFFFF", textShadow: "2px 2px 0 #555", letterSpacing: "1px" }}>{`STREAK`}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "flex-end" }}>
                    <span style={{ fontSize: 60, fontWeight: 900, color: "#FFFFFF", lineHeight: 0.8, textShadow: "5px 5px 0 #FF3A00" }}>{streakStr}</span>
                  </div>
                </div>
                {/* 03 SHIPPED */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                    padding: 30,
                    borderRight: "6px solid #FFFFFF",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                    <span style={{ fontSize: 28, fontWeight: 900, color: "#FF3A00", lineHeight: 1 }}>{`03`}</span>
                    <span style={{ fontSize: 20, fontWeight: 900, color: "#FFFFFF", textShadow: "2px 2px 0 #555", letterSpacing: "1px" }}>{`SHIPPED`}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "flex-end" }}>
                    <span style={{ fontSize: 76, fontWeight: 900, color: "#FFFFFF", lineHeight: 0.8, textShadow: "5px 5px 0 #FF3A00" }}>{projectsStr}</span>
                  </div>
                </div>
              </div>
              {/* Col 2 */}
              <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                {/* 02 MAX_STRK */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                    padding: 30,
                    borderBottom: "6px solid #FFFFFF",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                    <span style={{ fontSize: 28, fontWeight: 900, color: "#FF3A00", lineHeight: 1 }}>{`02`}</span>
                    <span style={{ fontSize: 20, fontWeight: 900, color: "#FFFFFF", textShadow: "2px 2px 0 #555", letterSpacing: "1px" }}>{`MAX_STRK`}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "flex-end" }}>
                    <span style={{ fontSize: 68, fontWeight: 900, color: "#FFFFFF", lineHeight: 0.8, textShadow: "5px 5px 0 #FF3A00" }}>{longestStr}</span>
                  </div>
                </div>
                {/* 04 STACK */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                    padding: 30,
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                    <span style={{ fontSize: 28, fontWeight: 900, color: "#FF3A00", lineHeight: 1 }}>{`04`}</span>
                    <span style={{ fontSize: 20, fontWeight: 900, color: "#FFFFFF", textShadow: "2px 2px 0 #555", letterSpacing: "1px" }}>{`STACK`}</span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 8 }}>
                    {topTech.length > 0 ? topTech.map((tech) => (
                      <span
                        key={tech}
                        style={{
                          fontSize: 16,
                          fontWeight: 700,
                          color: "#0F0F0F",
                          backgroundColor: "#FFFFFF",
                          padding: "8px 12px",
                          border: "3px solid #555",
                          boxShadow: "4px 4px 0 #FF3A00",
                        }}
                      >
                        {tech}
                      </span>
                    )) : (
                      <span style={{ fontSize: 14, color: "#555" }}>{`NO PROJECTS`}</span>
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
