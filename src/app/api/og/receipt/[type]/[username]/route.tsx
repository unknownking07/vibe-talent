import { ImageResponse } from "next/og";
import { fetchUserByUsernameCached } from "@/lib/supabase/server-queries";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type ReceiptType = "weekly" | "shipped" | "custom";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ type: string; username: string }> },
) {
  const { type, username } = await ctx.params;
  const validType = (["weekly", "shipped", "custom"] as const).includes(type as ReceiptType) ? (type as ReceiptType) : "weekly";

  const user = await fetchUserByUsernameCached(username);
  if (!user) {
    return new Response("Not Found", { status: 404 });
  }

  const lines = buildLines(validType, user);
  const headerSub = headerSubFor(validType);

  return new ImageResponse(
    (
      <div style={{
        width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
        background: "#0F0F0F", padding: 50, fontFamily: "ui-monospace, Menlo, monospace",
      }}>
        <div style={{
          background: "#fff", color: "#0F0F0F", padding: "36px 44px", width: "76%",
          boxShadow: "12px 12px 0 #FF3A00", position: "relative", display: "flex", flexDirection: "column",
        }}>
          <div style={{ textAlign: "center", borderBottom: "3px dashed #0F0F0F", paddingBottom: 16, marginBottom: 18, display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: "0.18em", display: "flex", justifyContent: "center" }}>VIBETALENT · {validType.toUpperCase()}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#3F3F46", letterSpacing: "0.08em", marginTop: 6, display: "flex", justifyContent: "center" }}>{headerSub}</div>
          </div>

          {lines.map(({ label, value, highlight }) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 22, padding: "4px 0", letterSpacing: "0.02em" }}>
              <span style={{ display: "flex" }}>{label}</span>
              <span style={{ fontWeight: 800, color: highlight ? "#FF3A00" : "#0F0F0F", display: "flex" }}>{value}</span>
            </div>
          ))}

          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "3px dashed #0F0F0F", display: "flex", justifyContent: "space-between", fontSize: 24, fontWeight: 800 }}>
            <span style={{ display: "flex" }}>VIBE_SCORE</span>
            <span style={{ color: "#FF3A00", fontSize: 28, display: "flex" }}>{user.vibe_score}</span>
          </div>

          <div style={{ display: "flex", gap: 2, justifyContent: "center", marginTop: 16 }}>
            {Array.from({ length: 32 }).map((_, i) => (
              <div key={i} style={{
                width: i % 3 === 0 ? 4 : 2,
                height: i % 2 === 0 ? 28 : 22,
                background: "#0F0F0F",
                display: "flex",
              }} />
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: 12, fontSize: 14, color: "#3F3F46", letterSpacing: "0.18em", fontWeight: 700, display: "flex", justifyContent: "center" }}>
            — THANK YOU FOR SHIPPING —
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}

function buildLines(_type: ReceiptType, user: { username: string; longest_streak?: number | null; streak?: number | null }): Array<{ label: string; value: string; highlight?: boolean }> {
  // For v1, just username + streak + longest. Receipt detail (commits, rank delta) gets
  // wired in Task 17 when we add /api/receipt/[username]/weekly.
  return [
    { label: "USER", value: `@${user.username}` },
    { label: "STREAK", value: `${user.streak ?? 0} days` },
    { label: "LONGEST", value: `${user.longest_streak ?? 0} days` },
  ];
}

function headerSubFor(type: ReceiptType): string {
  if (type === "weekly")  return "WEEKLY RECEIPT";
  if (type === "shipped") return "PROJECT SHIPPED";
  return "SHARED FROM PROFILE";
}
