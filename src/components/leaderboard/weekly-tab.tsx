"use client";

import { useEffect, useState } from "react";
import { LeaderboardRow, type LeaderboardRowProps } from "./row";

export function WeeklyTab() {
  const [rows, setRows] = useState<LeaderboardRowProps[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/leaderboard?range=week&limit=50");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (cancelled) return;
        const props: LeaderboardRowProps[] = (json.leaderboard ?? []).map(
          (r: {
            username: string;
            avatar_url: string | null;
            currentRank: number;
            previousRank: number | null;
            rankClimb: number | null;
            currentScore: number;
            scoreDelta: number | null;
          }, idx: number) => ({
            position: idx + 1,
            username: r.username,
            avatarUrl: r.avatar_url,
            currentRank: r.currentRank,
            previousRank: r.previousRank,
            rankClimb: r.rankClimb,
            currentScore: r.currentScore,
            scoreDelta: r.scoreDelta,
            isCrown: idx === 0,
          }),
        );
        setRows(props);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (error) {
    return (
      <div className="text-[13px] text-[var(--status-error-text)] bg-[var(--status-error-bg)] border border-[var(--status-error-border)] p-4 rounded">
        Couldn&apos;t load weekly leaderboard ({error}).
      </div>
    );
  }
  if (rows == null) {
    return <div className="text-[13px] text-[var(--text-muted)] p-4">Loading…</div>;
  }
  if (rows.length === 0) {
    return <div className="text-[13px] text-[var(--text-muted)] p-4">No climbers this week yet. Check back Monday.</div>;
  }

  return (
    <div className="bg-[var(--bg-surface)] border-2 border-[var(--border-hard)] rounded overflow-hidden" style={{ boxShadow: "var(--shadow-brutal)" }}>
      <header className="bg-[var(--bg-inverted)] text-[var(--text-on-inverted)] px-5 py-4 flex justify-between items-center">
        <h3 className="text-[15px] font-extrabold tracking-wider">LEADERBOARD</h3>
        <span className="bg-[var(--accent)] text-white px-3 py-1 text-[12px] font-extrabold rounded-sm">THIS WEEK ▲</span>
      </header>
      <div>
        {rows.map((r) => <LeaderboardRow key={r.username} {...r} />)}
      </div>
    </div>
  );
}
