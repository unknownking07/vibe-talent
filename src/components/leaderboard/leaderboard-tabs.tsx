"use client";

import { useState } from "react";
import { WeeklyTab } from "./weekly-tab";
import { AllTimeTab } from "./all-time-tab";
import type { UserWithSocials } from "@/lib/types/database";

type Tab = "week" | "all";

export function LeaderboardTabs({ users }: { users: UserWithSocials[] }) {
  const [tab, setTab] = useState<Tab>("week");

  return (
    <div>
      <div className="flex border-2 border-[var(--border-hard)] mb-4" role="tablist" aria-label="Leaderboard range">
        <button
          role="tab"
          aria-selected={tab === "week"}
          onClick={() => setTab("week")}
          className={`flex-1 py-3 px-4 text-[14px] font-bold border-r-2 border-[var(--border-hard)] ${tab === "week" ? "bg-[var(--accent)] text-white" : "bg-[var(--bg-surface)] text-[var(--foreground)]"}`}
        >
          Active this week 🔥
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

      {tab === "week" ? <WeeklyTab /> : <AllTimeTab users={users} />}
    </div>
  );
}
