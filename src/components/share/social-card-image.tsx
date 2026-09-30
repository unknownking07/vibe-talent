import type { ReactNode } from "react";

// The same warm neutrals and orange used by the website. The logo is the
// actual public/logo.png, bundled as a data URI by each image route.
const C = { ink: "#0f0f0f", paper: "#ede7e1", white: "#ffffff", orange: "#ff3a00", darkMuted: "#a69d98", lightMuted: "#625b57" };
export const SOCIAL_CARD_SIZE = { width: 1200, height: 630 };
type Tone = "dark" | "light";

function CardShell({ logoSrc, category, username, tone = "dark", children }: { logoSrc: string; category: string; username: string; tone?: Tone; children: ReactNode }) {
  const dark = tone === "dark";
  const muted = dark ? C.darkMuted : C.lightMuted;
  const rule = dark ? "#37312e" : "#cfc5bd";
  return (
    <div style={{ width: 1200, height: 630, display: "flex", flexDirection: "column", padding: "36px 48px 29px", background: dark ? C.ink : C.paper, color: dark ? C.white : C.ink, fontFamily: "Arial, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 70 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} alt="VibeTalent logo" width={62} height={62} style={{ width: 62, height: 62, borderRadius: 31 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", fontSize: 25, fontWeight: 900, letterSpacing: "-0.045em" }}>VIBE<span style={{ display: "flex", color: C.orange }}>TALENT</span></div>
            <div style={{ display: "flex", fontSize: 12, fontWeight: 700, letterSpacing: "0.18em", color: muted }}>BUILDERS WHO SHIP</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ display: "flex", width: 8, height: 8, borderRadius: 4, background: C.orange }} />
          <div style={{ display: "flex", fontSize: 15, fontWeight: 800, letterSpacing: "0.14em", color: muted }}>{category.toUpperCase()}</div>
        </div>
      </div>
      <div style={{ display: "flex", height: 1, background: rule, marginTop: 25 }} />
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>{children}</div>
      <div style={{ display: "flex", height: 1, background: rule }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 55, fontSize: 20, fontWeight: 700 }}>
        <div style={{ display: "flex", maxWidth: 650, overflow: "hidden" }}>@{username}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 11, color: muted }}><span style={{ display: "flex", color: C.orange }}>↗</span> vibetalent.work</div>
      </div>
    </div>
  );
}

function Kicker({ children }: { children: ReactNode }) {
  return <div style={{ display: "flex", fontSize: 16, fontWeight: 900, letterSpacing: "0.17em", color: C.orange }}>{children}</div>;
}

function Stat({ label, value, tone = "dark" }: { label: string; value: string | number; tone?: Tone }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7, minWidth: 0 }}>
      <span style={{ display: "flex", color: tone === "dark" ? C.darkMuted : C.lightMuted, fontSize: 13, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" }}>{label}</span>
      <span style={{ display: "flex", color: tone === "dark" ? C.white : C.ink, fontSize: 30, fontWeight: 900, letterSpacing: "-0.04em" }}>{value}</span>
    </div>
  );
}

export function ProfileSocialCard({ logoSrc, user }: { logoSrc: string; user: { username: string; display_name?: string | null; github_username?: string | null; vibe_score: number; streak: number; longest_streak: number; projects?: unknown[] } }) {
  const name = user.display_name?.trim() || user.username;
  const nameSize = name.length > 24 ? 58 : name.length > 15 ? 70 : 86;
  return (
    <CardShell logoSrc={logoSrc} category="Builder profile" username={user.username}>
      <div style={{ display: "flex", width: "100%", justifyContent: "space-between", padding: "31px 0 32px", gap: 36 }}>
        <div style={{ display: "flex", width: 728, flexDirection: "column", justifyContent: "space-between" }}>
          <Kicker>PROOF OF WORK / PUBLIC PROFILE</Kicker>
          <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
            <div style={{ display: "flex", fontSize: nameSize, fontWeight: 900, lineHeight: 0.99, letterSpacing: "-0.065em", maxHeight: 175, overflow: "hidden" }}>{name}</div>
            <div style={{ display: "flex", fontSize: 22, color: C.darkMuted }}>{user.github_username ? `GitHub connected · @${user.github_username}` : "Builder on VibeTalent"}</div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #37312e", paddingTop: 22, paddingRight: 28 }}>
            <Stat label="Current streak" value={`${user.streak ?? 0} days`} />
            <Stat label="Longest streak" value={`${user.longest_streak ?? 0} days`} />
            <Stat label="Projects" value={user.projects?.length ?? 0} />
          </div>
        </div>
        <div style={{ display: "flex", width: 330, flexDirection: "column", justifyContent: "space-between", background: C.orange, color: C.ink, borderRadius: 16, padding: "27px 29px 28px" }}>
          <span style={{ display: "flex", fontSize: 17, fontWeight: 900, letterSpacing: "0.13em" }}>VIBE SCORE</span>
          <span style={{ display: "flex", fontSize: 133, fontWeight: 900, lineHeight: 0.85, letterSpacing: "-0.09em", alignSelf: "flex-end" }}>{user.vibe_score}</span>
          <span style={{ display: "flex", fontSize: 17, fontWeight: 700, maxWidth: 240, lineHeight: 1.3 }}>A reputation you can inspect.</span>
        </div>
      </div>
    </CardShell>
  );
}

export function WeeklySocialCard({ logoSrc, username, weekLabel, activeDays, projects, streak, vibeScore }: { logoSrc: string; username: string; weekLabel: string; activeDays: number; projects: number; streak: number; vibeScore: number }) {
  return (
    <CardShell logoSrc={logoSrc} category="Weekly report" username={username} tone="light">
      <div style={{ display: "flex", width: "100%", justifyContent: "space-between", padding: "31px 0 32px", gap: 34 }}>
        <div style={{ display: "flex", width: 715, flexDirection: "column", justifyContent: "space-between" }}>
          <Kicker>YOUR WEEK / {weekLabel.toUpperCase()}</Kicker>
          <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
            <span style={{ display: "flex", flexDirection: "column", fontSize: 79, fontWeight: 900, lineHeight: 0.98, letterSpacing: "-0.065em" }}><span>A week of</span><span>showing up.</span></span>
            <span style={{ display: "flex", fontSize: 22, color: C.lightMuted }}>Recorded activity, one day at a time.</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #cfc5bd", paddingTop: 22, paddingRight: 35 }}>
            <Stat tone="light" label="Current streak" value={`${streak} days`} />
            <Stat tone="light" label="Projects added" value={projects} />
            <Stat tone="light" label="Vibe score" value={vibeScore} />
          </div>
        </div>
        <div style={{ display: "flex", width: 352, flexDirection: "column", justifyContent: "space-between", background: C.orange, color: C.ink, borderRadius: 16, padding: "29px 30px 28px" }}>
          <span style={{ display: "flex", fontSize: 17, fontWeight: 900, letterSpacing: "0.13em" }}>ACTIVE DAYS</span>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "flex-end" }}>
            <span style={{ display: "flex", fontSize: 159, fontWeight: 900, lineHeight: 0.9, letterSpacing: "-0.1em" }}>{activeDays}</span>
            <span style={{ display: "flex", fontSize: 48, fontWeight: 800, marginLeft: 6 }}>/7</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {Array.from({ length: 7 }, (_, i) => <div key={i} style={{ display: "flex", width: 34, height: 22, borderRadius: 4, background: i < activeDays ? C.ink : "#ff9473" }} />)}
          </div>
        </div>
      </div>
    </CardShell>
  );
}

export function ProjectSocialCard({ logoSrc, username, title, qualityScore, stack }: { logoSrc: string; username: string; title: string; qualityScore: number | null; stack: string[] }) {
  const titleSize = title.length > 30 ? 60 : title.length > 18 ? 72 : 91;
  return (
    <CardShell logoSrc={logoSrc} category="Shipped project" username={username}>
      <div style={{ display: "flex", width: "100%", justifyContent: "space-between", padding: "31px 0 33px", gap: 36 }}>
        <div style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: "space-between", minWidth: 0 }}>
          <Kicker>GITHUB VERIFIED / SHIPPED PROJECT</Kicker>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <span style={{ display: "flex", fontSize: titleSize, fontWeight: 900, lineHeight: 1.02, letterSpacing: "-0.06em", maxHeight: 190, overflow: "hidden" }}>{title}</span>
            <span style={{ display: "flex", fontSize: 25, color: C.darkMuted }}>Built. Shared. Verified.</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 43 }}>
            {stack.slice(0, 3).map((tech) => <span key={tech} style={{ display: "flex", padding: "10px 14px", borderRadius: 999, border: "1px solid #4b4440", color: C.white, fontSize: 16, fontWeight: 700 }}>{tech.slice(0, 18)}</span>)}
          </div>
        </div>
        <div style={{ display: "flex", width: 268, flexDirection: "column", justifyContent: "space-between", alignItems: "flex-end", borderLeft: "1px solid #37312e", paddingLeft: 27 }}>
          <span style={{ display: "flex", fontSize: 98, fontWeight: 900, lineHeight: 0.8, color: C.orange }}>↗</span>
          {qualityScore !== null ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }}>
              <span style={{ display: "flex", fontSize: 15, fontWeight: 800, letterSpacing: "0.13em", color: C.darkMuted }}>REPO QUALITY</span>
              <span style={{ display: "flex", fontSize: 54, fontWeight: 900, letterSpacing: "-0.05em" }}>{qualityScore}<span style={{ display: "flex", fontSize: 28, color: C.orange, marginTop: 17 }}>/100</span></span>
            </div>
          ) : <span style={{ display: "flex", fontSize: 16, fontWeight: 800, letterSpacing: "0.13em", color: C.orange }}>OWNER VERIFIED</span>}
        </div>
      </div>
    </CardShell>
  );
}

export function ActivitySocialCard({ logoSrc, username, period, activeDays, projects, vibeScore, streak }: { logoSrc: string; username: string; period: string; activeDays: number; projects: number; vibeScore: number; streak: number }) {
  return (
    <CardShell logoSrc={logoSrc} category="Builder activity" username={username} tone="light">
      <div style={{ display: "flex", width: "100%", justifyContent: "space-between", padding: "32px 0 34px", gap: 60 }}>
        <div style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: "space-between" }}>
          <Kicker>THE BUILDER RECORD / {period.toUpperCase()}</Kicker>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 21 }}>
            <span style={{ display: "flex", fontSize: 208, fontWeight: 900, lineHeight: 0.75, letterSpacing: "-0.1em" }}>{activeDays}</span>
            <span style={{ display: "flex", flexDirection: "column", fontSize: 33, fontWeight: 900, lineHeight: 1.05, paddingBottom: 5 }}><span style={{ display: "flex", color: C.orange }}>ACTIVE</span><span style={{ display: "flex" }}>DAYS</span></span>
          </div>
          <span style={{ display: "flex", fontSize: 23, color: C.lightMuted }}>Recorded activity on VibeTalent.</span>
        </div>
        <div style={{ display: "flex", width: 330, flexDirection: "column", justifyContent: "space-between", borderLeft: "1px solid #cfc5bd", padding: "8px 0 8px 43px" }}>
          <Stat tone="light" label="Projects added" value={projects} />
          <Stat tone="light" label="Current streak" value={`${streak} days`} />
          <Stat tone="light" label="Vibe score" value={vibeScore} />
        </div>
      </div>
    </CardShell>
  );
}

export function AchievementSocialCard({ logoSrc, username, title, description, status, medallion }: { logoSrc: string; username: string; title: string; description: string; status: string; medallion: ReactNode }) {
  const titleSize = title.length > 21 ? 58 : 75;
  return (
    <CardShell logoSrc={logoSrc} category="Achievement" username={username}>
      <div style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between", gap: 45 }}>
        <div style={{ display: "flex", width: 392, height: 370, alignItems: "center", justifyContent: "center", background: "#201a17", borderRadius: 16, flexShrink: 0 }}>{medallion}</div>
        <div style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: "center", minWidth: 0 }}>
          <Kicker>{status.toUpperCase()}</Kicker>
          <div style={{ display: "flex", fontSize: titleSize, fontWeight: 900, letterSpacing: "-0.055em", lineHeight: 1.02, marginTop: 21, maxHeight: 160, overflow: "hidden" }}>{title}</div>
          <div style={{ display: "flex", fontSize: 25, color: C.darkMuted, lineHeight: 1.3, marginTop: 18, maxHeight: 92, overflow: "hidden" }}>{description}</div>
          <div style={{ display: "flex", width: 102, height: 7, borderRadius: 4, background: C.orange, marginTop: 38 }} />
        </div>
      </div>
    </CardShell>
  );
}
