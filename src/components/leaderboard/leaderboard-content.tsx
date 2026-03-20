"use client";

import { useState } from "react";
import { BadgeDisplay } from "@/components/ui/badge-display";
import type { UserWithSocials } from "@/lib/types/database";
import { StreakCounter } from "@/components/ui/streak-counter";
import { VibeScore } from "@/components/ui/vibe-score";
import { Trophy, Flame, Code2, Zap } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

type Tab = "vibe_score" | "streak" | "projects";

export function LeaderboardContent({ users }: { users: UserWithSocials[] }) {
  const [activeTab, setActiveTab] = useState<Tab>("vibe_score");

  const sortedUsers = [...users]
    .filter((user) => {
      switch (activeTab) {
        case "streak":
          return user.longest_streak > 0;
        case "projects":
          return user.projects.length > 0;
        default:
          return true;
      }
    })
    .sort((a, b) => {
      switch (activeTab) {
        case "vibe_score":
          return b.vibe_score - a.vibe_score;
        case "streak":
          return b.longest_streak - a.longest_streak;
        case "projects":
          return b.projects.length - a.projects.length;
      }
    });

  const tabs: { id: Tab; label: string; icon: typeof Trophy }[] = [
    { id: "vibe_score", label: "Vibe Score", icon: Zap },
    { id: "streak", label: "Longest Streak", icon: Flame },
    { id: "projects", label: "Most Projects", icon: Code2 },
  ];

  const podium = sortedUsers.slice(0, 3);

  return (
    <>
      {/* Tabs */}
      <div className="flex justify-center mb-10">
        <div
          className="inline-flex gap-0"
          style={{ border: "2px solid #0F0F0F" }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold uppercase tracking-wide transition-colors"
              style={{
                backgroundColor: activeTab === tab.id ? "var(--accent)" : "#FFFFFF",
                color: activeTab === tab.id ? "#FFFFFF" : "#0F0F0F",
                borderRight: "2px solid #0F0F0F",
              }}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Podium */}
      <div className="grid grid-cols-3 gap-4 mb-10 max-w-3xl mx-auto items-end">
        {[1, 0, 2].map((idx) => {
          const user = podium[idx];
          if (!user) return null;
          const rank = idx + 1;
          const isFirst = rank === 1;
          const initials = user.username.slice(0, 2).toUpperCase();

          return (
            <Link
              href={`/profile/${user.username}`}
              key={user.id}
              className={`p-5 text-center transition-all hover:translate-x-[2px] hover:translate-y-[2px] ${
                isFirst ? "order-2" : rank === 2 ? "order-1" : "order-3"
              }`}
              style={{
                backgroundColor: "#FFFFFF",
                border: "2px solid #0F0F0F",
                boxShadow: isFirst ? "var(--shadow-brutal-accent)" : "var(--shadow-brutal)",
                transform: isFirst ? "translateY(-16px)" : undefined,
              }}
            >
              <div
                className={`mx-auto flex items-center justify-center font-extrabold text-white mb-3 overflow-hidden ${
                  isFirst ? "h-16 w-16 text-lg" : "h-12 w-12 text-sm"
                }`}
                style={{
                  backgroundColor: isFirst ? "var(--accent)" : "#0F0F0F",
                  border: "2px solid #0F0F0F",
                }}
              >
                {user.avatar_url ? (
                  <Image src={user.avatar_url} alt={user.username} width={64} height={64} className="w-full h-full object-cover" />
                ) : (
                  initials
                )}
              </div>
              <div className="text-xs font-extrabold text-[#71717A] mb-1 uppercase">#{rank}</div>
              <div className="font-extrabold text-[#0F0F0F] text-sm uppercase">@{user.username}</div>
              <div className="mt-2">
                <BadgeDisplay level={user.badge_level} size="sm" />
              </div>
              <div className="mt-3 flex flex-col items-center gap-1">
                <VibeScore score={user.vibe_score} size="sm" />
                <StreakCounter streak={user.streak} size="sm" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Table */}
      <div
        className="overflow-x-auto"
        style={{
          border: "2px solid #0F0F0F",
          boxShadow: "var(--shadow-brutal)",
        }}
      >
        <table className="w-full min-w-[500px]">
          <thead>
            <tr style={{ backgroundColor: "#0F0F0F" }}>
              <th className="px-3 sm:px-4 py-3 text-left text-xs font-extrabold uppercase tracking-wide text-white">Rank</th>
              <th className="px-3 sm:px-4 py-3 text-left text-xs font-extrabold uppercase tracking-wide text-white">Builder</th>
              <th className="px-3 sm:px-4 py-3 text-right text-xs font-extrabold uppercase tracking-wide text-white">Vibe Score</th>
              <th className="px-3 sm:px-4 py-3 text-right text-xs font-extrabold uppercase tracking-wide text-white hidden sm:table-cell">Streak</th>
              <th className="px-3 sm:px-4 py-3 text-right text-xs font-extrabold uppercase tracking-wide text-white hidden sm:table-cell">Projects</th>
              <th className="px-3 sm:px-4 py-3 text-right text-xs font-extrabold uppercase tracking-wide text-white">Badge</th>
            </tr>
          </thead>
          <tbody>
            {sortedUsers.map((user, i) => {
              const initials = user.username.slice(0, 2).toUpperCase();
              return (
                <tr
                  key={user.id}
                  className="transition-colors hover:bg-[#F5F5F5]"
                  style={{
                    backgroundColor: "#FFFFFF",
                    borderBottom: "2px solid #0F0F0F",
                  }}
                >
                  <td className="px-3 sm:px-4 py-3 text-sm font-extrabold font-mono text-[#71717A]">#{i + 1}</td>
                  <td className="px-3 sm:px-4 py-3">
                    <Link href={`/profile/${user.username}`} className="flex items-center gap-3 hover:text-[var(--accent)] transition-colors">
                      <div
                        className="flex h-8 w-8 items-center justify-center text-xs font-extrabold text-white shrink-0 overflow-hidden"
                        style={{ backgroundColor: "#0F0F0F", border: "2px solid #0F0F0F" }}
                      >
                        {user.avatar_url ? (
                          <Image src={user.avatar_url} alt={user.username} width={64} height={64} className="w-full h-full object-cover" />
                        ) : (
                          initials
                        )}
                      </div>
                      <span className="font-bold text-sm uppercase">@{user.username}</span>
                    </Link>
                  </td>
                  <td className="px-3 sm:px-4 py-3 text-right">
                    <VibeScore score={user.vibe_score} size="sm" />
                  </td>
                  <td className="px-3 sm:px-4 py-3 text-right hidden sm:table-cell">
                    <StreakCounter streak={user.streak} size="sm" />
                  </td>
                  <td className="px-3 sm:px-4 py-3 text-right text-sm font-bold text-[#52525B] hidden sm:table-cell">
                    {user.projects.length}
                  </td>
                  <td className="px-3 sm:px-4 py-3 text-right">
                    <BadgeDisplay level={user.badge_level} size="sm" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
