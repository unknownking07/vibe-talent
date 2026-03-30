"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Shield, Plus, Trash2, Rocket, Target, BarChart3, Calendar, TrendingUp, Users, Code2, Flame, RefreshCw } from "lucide-react";

const ADMIN_USERS = ["unknownking07", "stuart5915"];

type Initiative = { id: string; title: string; status: "active" | "planned" | "done" | "paused"; owner: string; notes: string; deadline: string };
type RoadmapItem = { id: string; title: string; priority: "high" | "medium" | "low"; status: "todo" | "in-progress" | "done"; notes: string };
type MetricEntry = { id: string; date: string; builders: number; projects: number; hires: number; visits: number; notes: string };
type LiveStats = { builders: number; projects: number; hires: number; endorsements: number; avgStreak: number; maxStreak: number; activeStreaks: number; avgVibeScore: number; badges: Record<string, number>; growth: { thisWeek: number; lastWeek: number; pct: number }; timestamp: string } | null;

const SC: Record<string, string> = { active: "#16a34a", planned: "#FF3A00", done: "#71717A", paused: "#d97706", todo: "#71717A", "in-progress": "#FF3A00", high: "#EF4444", medium: "#FF3A00", low: "#71717A" };

const SEED_INITIATIVES: Initiative[] = [
  { id: "1", title: "Bags Hackathon", status: "active", owner: "Abhinav", notes: "Top 10 on leaderboard", deadline: "" },
  { id: "2", title: "Product Hunt Launch", status: "active", owner: "Abhinav", notes: "Gaining traction", deadline: "" },
  { id: "3", title: "SEO / Google Search Console", status: "active", owner: "Abhinav", notes: "Indexing pending 3-7 days", deadline: "" },
  { id: "4", title: "Telegram Community", status: "planned", owner: "", notes: "Discussed but not created yet", deadline: "" },
  { id: "5", title: "User Growth (51 builders)", status: "active", owner: "Abhinav", notes: "Talking to users daily", deadline: "" },
];

function loadStoredData() {
  if (typeof window === "undefined") return null;
  try { const s = localStorage.getItem("vt-admin-data"); if (s) return JSON.parse(s); } catch { /* ignore */ }
  return null;
}

export default function AdminPage() {
  const [user, setUser] = useState<{ username: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [tab, setTab] = useState<"initiatives" | "roadmap" | "metrics">("initiatives");
  const dataLoaded = useRef(false);
  const [liveStats, setLiveStats] = useState<LiveStats>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const statsFetched = useRef(false);

  const stored = loadStoredData();
  const [initiatives, setInitiatives] = useState<Initiative[]>(stored?.initiatives ?? SEED_INITIATIVES);
  const [roadmap, setRoadmap] = useState<RoadmapItem[]>(stored?.roadmap ?? []);
  const [metrics, setMetrics] = useState<MetricEntry[]>(stored?.metrics ?? []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (!u) { setLoading(false); return; }
      const un = u.user_metadata?.user_name || u.user_metadata?.preferred_username || "";
      if (ADMIN_USERS.includes(un.toLowerCase())) { setUser({ username: un }); setAuthorized(true); }
      setLoading(false);
    });
  }, []);

  const fetchLiveStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await fetch("/api/admin-stats");
      if (res.ok) { const data = await res.json(); setLiveStats(data); }
    } catch { /* ignore */ }
    setStatsLoading(false);
  }, []);

  // Fetch stats when switching to metrics tab (via onClick, not useEffect)
  const handleTabClick = useCallback((t: "initiatives" | "roadmap" | "metrics") => {
    setTab(t);
    if (t === "metrics" && authorized && !statsFetched.current) {
      statsFetched.current = true;
      fetchLiveStats();
    }
  }, [authorized, fetchLiveStats]);

  useEffect(() => {
    if (!authorized || !dataLoaded.current) { dataLoaded.current = true; return; }
    localStorage.setItem("vt-admin-data", JSON.stringify({ initiatives, roadmap, metrics }));
  }, [initiatives, roadmap, metrics, authorized]);

  if (loading) return <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>Loading...</div>;
  if (!authorized) return (
    <div style={{ minHeight: "80vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px", padding: "24px" }}>
      <Shield size={48} style={{ color: "var(--accent)" }} />
      <h1 style={{ fontSize: "1.5rem", fontWeight: 800 }}>Admin Access Only</h1>
      <p style={{ color: "var(--text-muted)", textAlign: "center", maxWidth: 400 }}>Sign in with an authorized GitHub account.</p>
      <a href="/auth/login" style={{ padding: "12px 24px", background: "var(--accent)", color: "white", borderRadius: 8, fontWeight: 700, textDecoration: "none", border: "2px solid var(--border-hard)", boxShadow: "var(--shadow-brutal-sm)" }}>Sign In</a>
    </div>
  );

  const card: React.CSSProperties = { background: "var(--bg-surface)", border: "2px solid var(--border-hard)", borderRadius: 12, padding: 16, boxShadow: "var(--shadow-brutal-sm)" };
  const inp: React.CSSProperties = { padding: "6px 10px", borderRadius: 6, border: "2px solid var(--border-subtle)", fontSize: "0.78rem", background: "var(--bg-surface-light)", color: "var(--foreground)" };
  const btn: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", background: "var(--accent)", color: "white", border: "2px solid var(--border-hard)", borderRadius: 8, fontWeight: 700, fontSize: "0.82rem", cursor: "pointer", boxShadow: "var(--shadow-brutal-sm)" };
  const sel = (c: string): React.CSSProperties => ({ padding: "4px 8px", borderRadius: 6, border: "2px solid var(--border-subtle)", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", color: c, background: "var(--bg-surface)", cursor: "pointer" });
  const del: React.CSSProperties = { background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 };
  const tit: React.CSSProperties = { flex: 1, minWidth: 200, fontSize: "0.95rem", fontWeight: 700, background: "transparent", border: "none", color: "var(--foreground)", outline: "none" };
  const statCard: React.CSSProperties = { ...card, textAlign: "center", padding: "20px 16px" };
  const statNum: React.CSSProperties = { fontSize: "1.6rem", fontWeight: 900, fontFamily: "var(--font-jetbrains-mono)", color: "var(--foreground)" };
  const statLabel: React.CSSProperties = { fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginTop: 4 };

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "24px 16px 80px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}><Shield size={20} style={{ color: "var(--accent)" }} /><h1 style={{ fontSize: "1.5rem", fontWeight: 900 }}>VibeTalent HQ</h1></div>
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Signed in as <strong>{user?.username}</strong></p>
        </div>
        <div style={{ display: "flex", gap: 4, background: "var(--bg-surface)", border: "2px solid var(--border-hard)", borderRadius: 10, padding: 4, boxShadow: "var(--shadow-brutal-sm)" }}>
          {(["initiatives", "roadmap", "metrics"] as const).map(t => (
            <button key={t} onClick={() => handleTabClick(t)} style={{ padding: "8px 16px", borderRadius: 6, border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.82rem", textTransform: "capitalize", background: tab === t ? "var(--accent)" : "transparent", color: tab === t ? "white" : "var(--text-muted)" }}>{t}</button>
          ))}
        </div>
      </div>

      {tab === "initiatives" && <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}><Rocket size={18} /> Active Initiatives</h2>
          <button onClick={() => setInitiatives(p => [...p, { id: Date.now().toString(), title: "New Initiative", status: "planned", owner: "", notes: "", deadline: "" }])} style={btn}><Plus size={14} /> Add</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {initiatives.map(i => <div key={i.id} style={card}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
              <input value={i.title} onChange={e => setInitiatives(p => p.map(x => x.id === i.id ? { ...x, title: e.target.value } : x))} style={tit} />
              <select value={i.status} onChange={e => setInitiatives(p => p.map(x => x.id === i.id ? { ...x, status: e.target.value as Initiative["status"] } : x))} style={sel(SC[i.status])}><option value="active">Active</option><option value="planned">Planned</option><option value="done">Done</option><option value="paused">Paused</option></select>
              <button onClick={() => { if (confirm("Delete?")) setInitiatives(p => p.filter(x => x.id !== i.id)); }} style={del}><Trash2 size={14} /></button>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input value={i.owner} onChange={e => setInitiatives(p => p.map(x => x.id === i.id ? { ...x, owner: e.target.value } : x))} placeholder="Owner..." style={{ ...inp, flex: "0 0 120px" }} />
              <input value={i.notes} onChange={e => setInitiatives(p => p.map(x => x.id === i.id ? { ...x, notes: e.target.value } : x))} placeholder="Notes..." style={{ ...inp, flex: 1, minWidth: 200 }} />
              <input type="date" value={i.deadline} onChange={e => setInitiatives(p => p.map(x => x.id === i.id ? { ...x, deadline: e.target.value } : x))} style={inp} />
            </div>
          </div>)}
          {!initiatives.length && <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)", fontSize: "0.85rem" }}>No initiatives yet. Click + Add to start.</div>}
        </div>
      </div>}

      {tab === "roadmap" && <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}><Target size={18} /> Feature Roadmap</h2>
          <button onClick={() => setRoadmap(p => [...p, { id: Date.now().toString(), title: "New Feature", priority: "medium", status: "todo", notes: "" }])} style={btn}><Plus size={14} /> Add Feature</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {roadmap.map(i => <div key={i.id} style={{ ...card, opacity: i.status === "done" ? 0.6 : 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
              <input value={i.title} onChange={e => setRoadmap(p => p.map(x => x.id === i.id ? { ...x, title: e.target.value } : x))} style={{ ...tit, textDecoration: i.status === "done" ? "line-through" : "none" }} />
              <select value={i.priority} onChange={e => setRoadmap(p => p.map(x => x.id === i.id ? { ...x, priority: e.target.value as RoadmapItem["priority"] } : x))} style={sel(SC[i.priority])}><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select>
              <select value={i.status} onChange={e => setRoadmap(p => p.map(x => x.id === i.id ? { ...x, status: e.target.value as RoadmapItem["status"] } : x))} style={sel(SC[i.status])}><option value="todo">To Do</option><option value="in-progress">In Progress</option><option value="done">Done</option></select>
              <button onClick={() => { if (confirm("Delete?")) setRoadmap(p => p.filter(x => x.id !== i.id)); }} style={del}><Trash2 size={14} /></button>
            </div>
            <input value={i.notes} onChange={e => setRoadmap(p => p.map(x => x.id === i.id ? { ...x, notes: e.target.value } : x))} placeholder="Notes..." style={{ ...inp, width: "100%" }} />
          </div>)}
          {!roadmap.length && <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)", fontSize: "0.85rem" }}>No features yet. Click + Add Feature to plan.</div>}
        </div>
      </div>}

      {tab === "metrics" && <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}><BarChart3 size={18} /> Live Platform Stats</h2>
          <button onClick={() => fetchLiveStats()} style={{ ...btn, background: statsLoading ? "var(--text-muted)" : "var(--accent)" }} disabled={statsLoading}>
            <RefreshCw size={14} style={{ animation: statsLoading ? "spin 1s linear infinite" : "none" }} /> Refresh
          </button>
        </div>

        {liveStats ? <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginBottom: 16 }}>
            <div style={statCard}><Users size={18} style={{ color: "var(--accent)", margin: "0 auto 6px" }} /><div style={statNum}>{liveStats.builders}</div><div style={statLabel}>Total Builders</div></div>
            <div style={statCard}><Code2 size={18} style={{ color: "var(--accent)", margin: "0 auto 6px" }} /><div style={statNum}>{liveStats.projects}</div><div style={statLabel}>Projects Shipped</div></div>
            <div style={statCard}><Flame size={18} style={{ color: "var(--accent)", margin: "0 auto 6px" }} /><div style={statNum}>{liveStats.activeStreaks}</div><div style={statLabel}>Active Streaks</div></div>
            <div style={statCard}><TrendingUp size={18} style={{ color: liveStats.growth.pct >= 0 ? "#16a34a" : "#EF4444", margin: "0 auto 6px" }} /><div style={{ ...statNum, color: liveStats.growth.pct >= 0 ? "#16a34a" : "#EF4444" }}>{liveStats.growth.pct >= 0 ? "+" : ""}{liveStats.growth.pct}%</div><div style={statLabel}>Growth (7d)</div></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
            <div style={card}>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Streak Stats</div>
              {[["Avg Streak", `${liveStats.avgStreak} days`], ["Longest Streak", `${liveStats.maxStreak} days`], ["Avg Vibe Score", `${liveStats.avgVibeScore}`], ["Hire Requests", `${liveStats.hires}`], ["Endorsements", `${liveStats.endorsements}`]].map(([l, v]) => (
                <div key={l} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{l}</span><span style={{ fontWeight: 700, fontFamily: "var(--font-jetbrains-mono)" }}>{v}</span></div>
              ))}
            </div>
            <div style={card}>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Badge Distribution</div>
              {Object.entries(liveStats.badges).map(([level, count]) => (
                <div key={level} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", textTransform: "capitalize" }}>{level === "none" ? "No badge" : level}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: Math.max(4, (count / Math.max(liveStats.builders, 1)) * 120), height: 8, borderRadius: 4, background: level === "diamond" ? "#0891B2" : level === "gold" ? "#CA8A04" : level === "silver" ? "#71717A" : level === "bronze" ? "#D97706" : "var(--border-subtle)" }} />
                    <span style={{ fontWeight: 700, fontFamily: "var(--font-jetbrains-mono)", fontSize: "0.82rem", minWidth: 24, textAlign: "right" }}>{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={card}>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Weekly Signups</div>
            <div style={{ display: "flex", gap: 24 }}>
              <div><span style={{ fontFamily: "var(--font-jetbrains-mono)", fontWeight: 700, fontSize: "1.1rem" }}>{liveStats.growth.thisWeek}</span> <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>this week</span></div>
              <div><span style={{ fontFamily: "var(--font-jetbrains-mono)", fontWeight: 700, fontSize: "1.1rem" }}>{liveStats.growth.lastWeek}</span> <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>last week</span></div>
            </div>
            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 6 }}>Updated: {new Date(liveStats.timestamp).toLocaleString()}</div>
          </div>
        </> : <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>{statsLoading ? "Loading stats..." : "Click Refresh to load live stats."}</div>}

        <div style={{ marginTop: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}><Calendar size={16} /> Manual Notes</h3>
            <button onClick={() => setMetrics(p => [{ id: Date.now().toString(), date: new Date().toISOString().slice(0, 10), builders: 0, projects: 0, hires: 0, visits: 0, notes: "" }, ...p])} style={{ ...btn, fontSize: "0.75rem", padding: "6px 12px" }}><Plus size={12} /> Add Note</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {metrics.map(e => <div key={e.id} style={card}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <input type="date" value={e.date} onChange={ev => setMetrics(p => p.map(x => x.id === e.id ? { ...x, date: ev.target.value } : x))} style={inp} />
                <input value={e.notes} onChange={ev => setMetrics(p => p.map(x => x.id === e.id ? { ...x, notes: ev.target.value } : x))} placeholder="What happened..." style={{ ...inp, flex: 1, minWidth: 200 }} />
                <button onClick={() => setMetrics(p => p.filter(x => x.id !== e.id))} style={del}><Trash2 size={14} /></button>
              </div>
            </div>)}
          </div>
        </div>
      </div>}
    </div>
  );
}
