"use client";

import { useEffect, useState } from "react";
import { WeeklyTab } from "./weekly-tab";
import { AllTimeTab } from "./all-time-tab";
import type { UserWithSocials } from "@/lib/types/database";
import type { ActiveBuilderRowProps } from "./active-builder-row";

type Tab = "week" | "all";

type WeeklyApiRow = {
  username: string;
  avatar_url: string | null;
  currentRank: number;
  activeDays7d: number;
  commits7d: number;
  streak: number;
  vibeScore: number;
};

export function LeaderboardTabs({ users }: { users: UserWithSocials[] }) {
  const [tab, setTab] = useState<Tab>("week");
  const [weeklyRows, setWeeklyRows] = useState<ActiveBuilderRowProps[] | null>(null);
  const [weeklyError, setWeeklyError] = useState<string | null>(null);

  // Fetch once on mount and keep the data in parent state, so toggling tabs
  // doesn't unmount/remount the weekly view or re-trigger the fetch.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/leaderboard?range=week&limit=50");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (cancelled) return;
        const props: ActiveBuilderRowProps[] = (json.leaderboard ?? []).map(
          (r: WeeklyApiRow, idx: number) => ({
            position: idx + 1,
            username: r.username,
            avatarUrl: r.avatar_url,
            currentRank: r.currentRank,
            activeDays7d: r.activeDays7d,
            commits7d: r.commits7d,
            streak: r.streak,
            vibeScore: r.vibeScore,
            isCrown: idx === 0,
          }),
        );
        setWeeklyRows(props);
      } catch (e) {
        if (!cancelled) setWeeklyError((e as Error).message);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div>
      <div className="flex border-2 border-[var(--border-hard)] mb-4" role="tablist" aria-label="Leaderboard range">
        <button
          role="tab"
          aria-selected={tab === "week"}
          onClick={() => setTab("week")}
          className={`flex-1 py-3 px-4 text-[14px] font-bold border-r-2 border-[var(--border-hard)] ${tab === "week" ? "bg-[var(--accent)] text-white" : "bg-[var(--bg-surface)] text-[var(--foreground)]"}`}
        >
          This week
        </button>
        <button
          role="tab"
          aria-selected={tab === "all"}
          onClick={() => setTab("all")}
          className={`flex-1 py-3 px-4 text-[14px] font-bold ${tab === "all" ? "bg-[var(--accent)] text-white" : "bg-[var(--bg-surface)] text-[var(--foreground)]"}`}
        >
          All-time
        </button>
      </div>

      {tab === "week" ? <WeeklyTab rows={weeklyRows} error={weeklyError} /> : <AllTimeTab users={users} />}
    </div>
  );
}
