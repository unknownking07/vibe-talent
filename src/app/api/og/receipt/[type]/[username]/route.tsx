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
  // validType is currently computed for future per-type detail rows; keep it for parity.
  void validType;

  const user = await fetchUserByUsernameCached(username);
  if (!user) {
    return new Response("Not Found", { status: 404 });
  }

  const lines = buildLines(user);

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
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "3px dashed #0F0F0F",
            paddingBottom: 18,
            marginBottom: 18,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <Avatar user={user} size={100} />
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ display: "flex", fontSize: 32, fontWeight: 900, letterSpacing: "-0.02em" }}>
                  @{user.username}
                </span>
                {user.github_username ? <VerifiedBadge size={32} /> : null}
              </div>
            </div>
            <div style={{ display: "flex", fontSize: 14, fontWeight: 900, letterSpacing: "0.18em", color: "#0F0F0F" }}>
              VIBE<span style={{ display: "flex", color: "#FF3A00" }}>TALENT</span>
            </div>
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

function buildLines(user: { longest_streak?: number | null; streak?: number | null }): Array<{ label: string; value: string; highlight?: boolean }> {
  // For v1, just streak + longest. Receipt detail (commits, rank delta) gets
  // wired in Task 17 when we add /api/receipt/[username]/weekly. Username is in the header.
  return [
    { label: "STREAK", value: `${user.streak ?? 0} days` },
    { label: "LONGEST", value: `${user.longest_streak ?? 0} days` },
  ];
}

function Avatar({ user, size }: { user: { username: string; avatar_url: string | null }; size: number }) {
  const url = user.avatar_url;
  const valid = typeof url === "string" && /^https?:\/\//.test(url);
  if (valid) {
    return (
      <div style={{
        display: "flex",
        width: size, height: size,
        borderRadius: "50%",
        overflow: "hidden",
        border: "2.5px solid #0F0F0F",
        flexShrink: 0,
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          width={size}
          height={size}
          alt=""
          style={{ display: "flex", objectFit: "cover", width: size, height: size }}
        />
      </div>
    );
  }
  return (
    <div style={{
      display: "flex",
      width: size, height: size,
      borderRadius: "50%",
      border: "2.5px solid #0F0F0F",
      background: "linear-gradient(135deg, #FF3A00, #FFA07A)",
      color: "#fff",
      fontWeight: 900,
      fontSize: size * 0.42,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    }}>
      {(user.username[0] ?? "?").toUpperCase()}
    </div>
  );
}

function VerifiedBadge({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ display: "flex", flexShrink: 0 }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx={12} cy={12} r={11} fill="#FF3A00" stroke="#0F0F0F" strokeWidth={1.5} />
      <path
        d="M7 12.5l3 3 7-7"
        fill="none"
        stroke="#fff"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
