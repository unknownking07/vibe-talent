"use client";

import { useState, useCallback } from "react";
import { BadgeDisplay } from "@/components/ui/badge-display";
import type { UserWithSocials } from "@/lib/types/database";
import { StreakCounter } from "@/components/ui/streak-counter";
import { VibeScore } from "@/components/ui/vibe-score";
import { Trophy, Flame, Code2, Zap, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

const PAGE_SIZE = 15;
type Tab = "vibe_score" | "streak" | "projects";

export function LeaderboardContent({ users }: { users: UserWithSocials[] }) {
  const [activeTab, _setActiveTab] = useState<Tab>("vibe_score");
  const [currentPage, setCurrentPage] = useState(1);

  const setActiveTab = useCallback((v: Tab) => { _setActiveTab(v); setCurrentPage(1); }, []);
  const goToPage = useCallback((page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

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
  const totalPages = Math.ceil(sortedUsers.length / PAGE_SIZE);
  const activePage = currentPage > totalPages ? 1 : currentPage;
  const paginatedUsers = sortedUsers.slice(
    (activePage - 1) * PAGE_SIZE,
    activePage * PAGE_SIZE
  );

  return (
    <>
      {/* Tabs */}
      <div className="flex justify-center mb-10">
        <div
          className="inline-flex gap-0"
          style={{ border: "2px solid var(--border-hard)" }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold uppercase tracking-wide transition-colors"
              style={{
                backgroundColor: activeTab === tab.id ? "var(--accent)" : "var(--bg-surface)",
                color: activeTab === tab.id ? "var(--background)" : "var(--foreground)",
                borderRight: "2px solid var(--border-hard)",
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
                backgroundColor: "var(--bg-surface)",
                border: "2px solid var(--border-hard)",
                boxShadow: isFirst ? "var(--shadow-brutal-accent)" : "var(--shadow-brutal)",
                transform: isFirst ? "translateY(-16px)" : undefined,
              }}
            >
              <div
                className={`mx-auto flex items-center justify-center font-extrabold text-white mb-3 overflow-hidden ${
                  isFirst ? "h-16 w-16 text-lg" : "h-12 w-12 text-sm"
                }`}
                style={{
                  backgroundColor: isFirst ? "var(--accent)" : "var(--bg-inverted)",
                  border: "2px solid var(--border-hard)",
                }}
              >
                {user.avatar_url ? (
                  <Image src={user.avatar_url} alt={user.username} width={64} height={64} className="w-full h-full object-cover" />
                ) : (
                  initials
                )}
              </div>
              <div className="text-xs font-extrabold text-[var(--text-muted)] mb-1 uppercase">#{rank}</div>
              <div className="font-extrabold text-[var(--foreground)] text-sm uppercase">@{user.username}</div>
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
          border: "2px solid var(--border-hard)",
          boxShadow: "var(--shadow-brutal)",
        }}
      >
        <table className="w-full min-w-[500px]">
          <thead>
            <tr style={{ backgroundColor: "var(--bg-inverted)" }}>
              <th className="px-3 sm:px-4 py-3 text-left text-xs font-extrabold uppercase tracking-wide text-white">Rank</th>
              <th className="px-3 sm:px-4 py-3 text-left text-xs font-extrabold uppercase tracking-wide text-white">Builder</th>
              <th className="px-3 sm:px-4 py-3 text-right text-xs font-extrabold uppercase tracking-wide text-white">Vibe Score</th>
              <th className="px-3 sm:px-4 py-3 text-right text-xs font-extrabold uppercase tracking-wide text-white hidden sm:table-cell">Streak</th>
              <th className="px-3 sm:px-4 py-3 text-right text-xs font-extrabold uppercase tracking-wide text-white hidden sm:table-cell">Projects</th>
              <th className="px-3 sm:px-4 py-3 text-right text-xs font-extrabold uppercase tracking-wide text-white">Badge</th>
            </tr>
          </thead>
          <tbody>
            {paginatedUsers.map((user, i) => {
              const rank = (activePage - 1) * PAGE_SIZE + i + 1;
              const initials = user.username.slice(0, 2).toUpperCase();
              return (
                <tr
                  key={user.id}
                  className="transition-colors hover:bg-[var(--bg-surface-light)]"
                  style={{
                    backgroundColor: "var(--bg-surface)",
                    borderBottom: "2px solid var(--border-hard)",
                  }}
                >
                  <td className="px-3 sm:px-4 py-3 text-sm font-extrabold font-mono text-[var(--text-muted)]">#{rank}</td>
                  <td className="px-3 sm:px-4 py-3">
                    <Link href={`/profile/${user.username}`} className="flex items-center gap-3 hover:text-[var(--accent)] transition-colors">
                      <div
                        className="flex h-8 w-8 items-center justify-center text-xs font-extrabold text-white shrink-0 overflow-hidden"
                        style={{ backgroundColor: "var(--bg-inverted)", border: "2px solid var(--border-hard)" }}
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
                  <td className="px-3 sm:px-4 py-3 text-right text-sm font-bold text-[var(--text-secondary)] hidden sm:table-cell">
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

      {/* Results count + Pagination */}
      {sortedUsers.length > PAGE_SIZE && (
        <>
          <p className="mt-4 text-sm font-bold uppercase tracking-wide text-[var(--text-muted)] text-center">
            Showing {(activePage - 1) * PAGE_SIZE + 1}–{Math.min(activePage * PAGE_SIZE, sortedUsers.length)} of {sortedUsers.length} builders
          </p>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <button
                onClick={() => goToPage(activePage - 1)}
                disabled={activePage === 1}
                className="flex items-center justify-center w-10 h-10 font-extrabold uppercase transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: "var(--bg-surface)",
                  border: "2px solid var(--border-hard)",
                  boxShadow: "var(--shadow-brutal-sm)",
                }}
              >
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => goToPage(page)}
                  className="flex items-center justify-center w-10 h-10 text-sm font-extrabold uppercase transition-all"
                  style={{
                    backgroundColor: activePage === page ? "var(--accent)" : "var(--bg-surface)",
                    color: activePage === page ? "#FFFFFF" : "var(--foreground)",
                    border: "2px solid var(--border-hard)",
                    boxShadow: activePage === page ? "none" : "var(--shadow-brutal-sm)",
                  }}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => goToPage(activePage + 1)}
                disabled={activePage === totalPages}
                className="flex items-center justify-center w-10 h-10 font-extrabold uppercase transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: "var(--bg-surface)",
                  border: "2px solid var(--border-hard)",
                  boxShadow: "var(--shadow-brutal-sm)",
                }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}
