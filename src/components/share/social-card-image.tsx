import type { ReactNode } from "react";

// Keep these aligned with the site's warm dark surfaces and orange action color.
// Every image route uses this shell so a shared link reads as VibeTalent even
// when the platform strips the surrounding page and only shows the PNG.
const C = {
  bg: "#171311",
  panel: "#211b18",
  cream: "#f7f1e9",
  muted: "#aa9c91",
  line: "#504139",
  orange: "#ff4b1f",
};

const sans = "Arial, sans-serif";

export const SOCIAL_CARD_SIZE = { width: 1200, height: 630 };

function Brand() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
      <div style={{ display: "flex", width: 27, height: 27, background: C.orange, transform: "rotate(-10deg)" }} />
      <div style={{ display: "flex", color: C.cream, fontSize: 21, fontWeight: 900, letterSpacing: "0.07em" }}>
        VIBE<span style={{ display: "flex", color: C.orange }}>TALENT</span>
      </div>
    </div>
  );
}

export function CardShell({
  category,
  username,
  children,
}: {
  category: string;
  username: string;
  children: ReactNode;
}) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: C.bg, color: C.cream, padding: "34px 44px 36px", fontFamily: sans }}>
      <div style={{ display: "flex", height: 7, background: C.orange, margin: "-34px -44px 27px" }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 34 }}>
        <Brand />
        <div style={{ display: "flex", fontSize: 15, fontWeight: 800, letterSpacing: "0.2em", color: C.muted }}>
          {category.toUpperCase()}
        </div>
      </div>
      <div style={{ display: "flex", flex: 1, minHeight: 0, marginTop: 27, padding: 38, border: `2px solid ${C.line}`, background: C.panel, position: "relative", overflow: "hidden" }}>
        <div style={{ display: "flex", width: 10, height: 70, background: C.orange, position: "absolute", top: 38, left: 0 }} />
        {children}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 21, fontSize: 17, fontWeight: 700, color: C.muted }}>
        <span style={{ display: "flex" }}>@{username}</span>
        <span style={{ display: "flex", letterSpacing: "0.06em" }}>vibetalent.work ↗</span>
      </div>
    </div>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <div style={{ display: "flex", fontSize: 16, fontWeight: 800, letterSpacing: "0.18em", color: C.orange }}>{children}</div>;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1, minWidth: 0, padding: "16px 20px", borderLeft: `1px solid ${C.line}` }}>
      <span style={{ display: "flex", fontSize: 14, fontWeight: 800, letterSpacing: "0.1em", color: C.muted, textTransform: "uppercase" }}>{label}</span>
      <span style={{ display: "flex", fontSize: 34, fontWeight: 900, letterSpacing: "-0.04em", color: C.cream }}>{value}</span>
    </div>
  );
}

export function ProfileSocialCard({ user }: { user: { username: string; display_name?: string | null; github_username?: string | null; vibe_score: number; streak: number; longest_streak: number; projects?: unknown[] } }) {
  const name = user.display_name?.trim() || `@${user.username}`;
  return (
    <CardShell category="Builder profile / 01" username={user.username}>
      <div style={{ display: "flex", flexDirection: "column", width: "100%", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Eyebrow>PROOF OF WORK, ON RECORD</Eyebrow>
          {user.github_username ? <span style={{ display: "flex", fontSize: 15, fontWeight: 800, color: C.cream, border: `1px solid ${C.line}`, padding: "9px 13px" }}>● GITHUB LINKED</span> : null}
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", width: "56%", minWidth: 0 }}>
            <div style={{ display: "flex", fontSize: 46, fontWeight: 900, letterSpacing: "-0.045em", lineHeight: 1.05, maxHeight: 100, overflow: "hidden" }}>{name}</div>
            <div style={{ display: "flex", fontSize: 19, color: C.muted, marginTop: 10 }}>Builder reputation you can inspect.</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <span style={{ display: "flex", fontSize: 16, fontWeight: 800, letterSpacing: "0.16em", color: C.muted }}>VIBE SCORE</span>
            <span style={{ display: "flex", fontSize: 142, fontWeight: 900, lineHeight: 0.9, letterSpacing: "-0.08em", color: C.orange }}>{user.vibe_score}</span>
          </div>
        </div>
        <div style={{ display: "flex", borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}` }}>
          <Metric label="Current streak" value={`${user.streak ?? 0}d`} />
          <Metric label="Longest streak" value={`${user.longest_streak ?? 0}d`} />
          <Metric label="Projects shipped" value={user.projects?.length ?? 0} />
        </div>
      </div>
    </CardShell>
  );
}

export function WeeklySocialCard({ username, weekLabel, activeDays, commits, projects, vibeScore }: { username: string; weekLabel: string; activeDays: number; commits: number; projects: number; vibeScore: number }) {
  return (
    <CardShell category="Weekly report / 02" username={username}>
      <div style={{ display: "flex", flexDirection: "column", width: "100%", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Eyebrow>THE WEEK IN PUBLIC WORK</Eyebrow>
          <span style={{ display: "flex", fontSize: 17, fontWeight: 800, color: C.muted }}>{weekLabel}</span>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ display: "flex", fontSize: 54, fontWeight: 900, letterSpacing: "-0.055em", lineHeight: 1.03 }}>A week of<br />showing up.</span>
            <span style={{ display: "flex", fontSize: 20, color: C.muted, marginTop: 13 }}>Public GitHub activity, week by week.</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <span style={{ display: "flex", fontSize: 133, fontWeight: 900, lineHeight: 0.85, letterSpacing: "-0.08em", color: C.orange }}>{activeDays}<span style={{ display: "flex", fontSize: 50, color: C.cream, alignSelf: "flex-end", marginBottom: 12 }}>/7</span></span>
            <span style={{ display: "flex", fontSize: 17, fontWeight: 800, letterSpacing: "0.12em", color: C.muted, marginTop: 12 }}>ACTIVE DAYS</span>
          </div>
        </div>
        <div style={{ display: "flex", borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}` }}>
          <Metric label="Public commits" value={commits} />
          <Metric label="Projects added" value={projects} />
          <Metric label="Current vibe score" value={vibeScore} />
        </div>
      </div>
    </CardShell>
  );
}

export function ProjectSocialCard({ username, title, qualityScore, stack }: { username: string; title: string; qualityScore: number | null; stack: string[] }) {
  return (
    <CardShell category="Shipped project / 03" username={username}>
      <div style={{ display: "flex", flexDirection: "column", width: "100%", justifyContent: "space-between" }}>
        <Eyebrow>GITHUB VERIFIED PROJECT</Eyebrow>
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 850 }}>
          <div style={{ display: "flex", fontSize: 74, fontWeight: 900, letterSpacing: "-0.06em", lineHeight: 1.02, maxHeight: 165, overflow: "hidden" }}>{title}</div>
          <div style={{ display: "flex", color: C.orange, fontSize: 28, fontWeight: 800, marginTop: 17 }}>Built. Shared. Verified.</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: `1px solid ${C.line}`, paddingTop: 24 }}>
          <div style={{ display: "flex", gap: 10 }}>
            {stack.slice(0, 3).map((tech) => <span key={tech} style={{ display: "flex", padding: "8px 12px", border: `1px solid ${C.line}`, fontSize: 15, fontWeight: 700, color: C.muted }}>{tech.slice(0, 20)}</span>)}
          </div>
          {qualityScore !== null ? <span style={{ display: "flex", fontSize: 22, fontWeight: 800 }}>QUALITY <span style={{ display: "flex", color: C.orange, marginLeft: 12 }}>{qualityScore}/100</span></span> : null}
        </div>
      </div>
    </CardShell>
  );
}

export function ActivitySocialCard({ username, period, activeDays, projects, vibeScore, streak }: { username: string; period: string; activeDays: number; projects: number; vibeScore: number; streak: number }) {
  return (
    <CardShell category="Builder activity / 05" username={username}>
      <div style={{ display: "flex", flexDirection: "column", width: "100%", justifyContent: "space-between" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Eyebrow>THE BUILDER RECORD</Eyebrow>
          <span style={{ display: "flex", fontSize: 16, fontWeight: 800, color: C.muted }}>{period.toUpperCase()}</span>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ display: "flex", fontSize: 56, fontWeight: 900, letterSpacing: "-0.055em", lineHeight: 1.02 }}>Proof over<br />promises.</span>
            <span style={{ display: "flex", fontSize: 20, color: C.muted, marginTop: 15 }}>Public work on VibeTalent.</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <span style={{ display: "flex", fontSize: 143, fontWeight: 900, lineHeight: 0.9, letterSpacing: "-0.08em", color: C.orange }}>{activeDays}</span>
            <span style={{ display: "flex", fontSize: 17, fontWeight: 800, color: C.muted, letterSpacing: "0.12em" }}>ACTIVE DAYS</span>
          </div>
        </div>
        <div style={{ display: "flex", borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}` }}>
          <Metric label="Projects added" value={projects} />
          <Metric label="Current streak" value={`${streak}d`} />
          <Metric label="Vibe score" value={vibeScore} />
        </div>
      </div>
    </CardShell>
  );
}

export function AchievementSocialCard({ username, title, description, status, medallion }: { username: string; title: string; description: string; status: string; medallion: ReactNode }) {
  return (
    <CardShell category="Achievement / 04" username={username}>
      <div style={{ display: "flex", alignItems: "center", width: "100%", gap: 34 }}>
        <div style={{ display: "flex", width: 355, height: 355, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{medallion}</div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 0, flex: 1 }}>
          <Eyebrow>{status.toUpperCase()}</Eyebrow>
          <div style={{ display: "flex", fontSize: 62, fontWeight: 900, letterSpacing: "-0.05em", lineHeight: 1.02, marginTop: 17, maxHeight: 190, overflow: "hidden" }}>{title}</div>
          <div style={{ display: "flex", fontSize: 24, color: C.muted, lineHeight: 1.28, marginTop: 16, maxHeight: 100, overflow: "hidden" }}>{description}</div>
          <div style={{ display: "flex", marginTop: 26, width: 100, height: 6, background: C.orange }} />
        </div>
      </div>
    </CardShell>
  );
}
