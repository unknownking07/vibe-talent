"use client";

import { useState, useCallback } from "react";
import { BadgeDisplay } from "@/components/ui/badge-display";
import type { UserWithSocials } from "@/lib/types/database";
import { StreakCounter } from "@/components/ui/streak-counter";
import { VibeScore } from "@/components/ui/vibe-score";
import { Pagination } from "@/components/ui/pagination";
import Link from "next/link";
import Image from "next/image";
import { Code, Fire, Lightning, SealCheck } from "@phosphor-icons/react";

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
          return (user.projects ?? []).length > 0;
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

  // The streak board ranks on `longest_streak`, so its Streak column has to
  // show that same figure. Rendering `streak` (the run they are on today)
  // there put builders whose streak has since broken near the top beside a
  // 0, which reads as a leaderboard that cannot sort. Every other board keeps
  // showing the live streak, so the header renames to say which one it is.
  const isStreakBoard = activeTab === "streak";
  const streakShown = (user: UserWithSocials) =>
    isStreakBoard ? user.longest_streak : user.streak;

  // Shape-typed rather than `typeof Trophy`: the map now mixes Phosphor
  // components with the hand-drawn brand glyphs, which are plain function
  // components rather than forwardRef exotics.
  const tabs: {
    id: Tab;
    label: string;
    icon: React.ComponentType<{ size?: number; weight?: "fill" | "duotone" | "regular" | "bold"; className?: string }>;
  }[] = [
    { id: "vibe_score", label: "Vibe Score", icon: Lightning },
    { id: "streak", label: "Longest Streak", icon: Fire },
    { id: "projects", label: "Most Projects", icon: Code },
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
        <div className="inline-flex rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-colors ${
                activeTab === tab.id
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface-light)]"
              }`}
            >
              <tab.icon weight="fill" size={16} />
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
              className={`p-5 text-center rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] transition-all hover:-translate-y-0.5 ${
                isFirst
                  ? "order-2 shadow-[var(--shadow-brutal-accent)]"
                  : `shadow-[var(--shadow-brutal-sm)] hover:shadow-[var(--shadow-brutal-hover)] ${rank === 2 ? "order-1" : "order-3"}`
              }`}
              style={{
                transform: isFirst ? "translateY(-16px)" : undefined,
              }}
            >
              <div
                className={`mx-auto flex items-center justify-center rounded-full font-bold text-white mb-3 overflow-hidden ${
                  isFirst ? "h-16 w-16 text-lg" : "h-12 w-12 text-sm"
                }`}
                style={{
                  backgroundColor: isFirst ? "var(--accent)" : "var(--bg-inverted)",
                  border: "1px solid var(--border-hard)",
                }}
              >
                {user.avatar_url ? (
                  <Image src={user.avatar_url} alt={user.username} width={64} height={64} className="w-full h-full object-cover" />
                ) : (
                  initials
                )}
              </div>
              <div className="text-xs font-mono font-bold text-[var(--text-muted)] mb-1">#{rank}</div>
              <div className="font-bold uppercase text-[var(--foreground)] text-sm flex items-center justify-center gap-1">
                {user.display_name || `@${user.username}`}
                {user.github_username && (
                  <SealCheck weight="fill" size={14} className="text-[var(--verified)] shrink-0" aria-label="GitHub verified" />
                )}
              </div>
              {user.display_name && (
                <div className="text-xs font-medium text-[var(--text-muted)]">@{user.username}</div>
              )}
              <div className="mt-2">
                <BadgeDisplay level={user.badge_level} size="sm" />
              </div>
              <div className="mt-3 flex flex-col items-center gap-1">
                <VibeScore score={user.vibe_score} size="sm" />
                <StreakCounter streak={streakShown(user)} size="sm" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Table — Streak + Projects columns are `hidden sm:table-cell` so the
          remaining 4 columns fit a 320px viewport without horizontal scroll.
          Keeping `overflow-x-auto` as a safety net for the rare locale that
          pushes a column wider, but the previous `min-w-[500px]` forced a
          carousel on every mobile render and is gone. */}
      <div className="overflow-x-auto rounded-2xl border border-[var(--border-subtle)] shadow-[var(--shadow-brutal-sm)]">
        <table className="w-full">
          <thead>
            <tr style={{ backgroundColor: "var(--bg-inverted)" }}>
              <th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold text-white">Rank</th>
              <th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold text-white">Builder</th>
              <th className="px-3 sm:px-4 py-3 text-right text-xs font-semibold text-white">Vibe Score</th>
              <th className="px-3 sm:px-4 py-3 text-right text-xs font-semibold text-white hidden sm:table-cell">
                {isStreakBoard ? "Longest" : "Streak"}
              </th>
              <th className="px-3 sm:px-4 py-3 text-right text-xs font-semibold text-white hidden sm:table-cell">Projects</th>
              <th className="px-3 sm:px-4 py-3 text-right text-xs font-semibold text-white">Badge</th>
            </tr>
          </thead>
          <tbody>
            {paginatedUsers.map((user, i) => {
              const rank = (activePage - 1) * PAGE_SIZE + i + 1;
              const initials = user.username.slice(0, 2).toUpperCase();
              return (
                <tr
                  key={user.id}
                  className="bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] last:border-b-0 transition-colors hover:bg-[var(--bg-surface-light)]"
                >
                  <td className="px-3 sm:px-4 py-3 text-sm font-bold font-mono text-[var(--text-muted)]">#{rank}</td>
                  <td className="px-3 sm:px-4 py-3">
                    <Link href={`/profile/${user.username}`} className="flex items-center gap-3 hover:text-[var(--accent)] transition-colors">
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white shrink-0 overflow-hidden"
                        style={{ backgroundColor: "var(--bg-inverted)", border: "1px solid var(--border-hard)" }}
                      >
                        {user.avatar_url ? (
                          <Image src={user.avatar_url} alt={user.username} width={64} height={64} className="w-full h-full object-cover" />
                        ) : (
                          initials
                        )}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-sm flex items-center gap-1 truncate">
                          {user.display_name || `@${user.username}`}
                          {user.github_username && (
                            <SealCheck weight="fill" size={14} className="text-[var(--verified)] shrink-0" aria-label="GitHub verified" />
                          )}
                        </span>
                        {user.display_name && (
                          <span className="text-xs font-medium text-[var(--text-muted)] truncate">@{user.username}</span>
                        )}
                      </div>
                    </Link>
                  </td>
                  <td className="px-3 sm:px-4 py-3 text-right">
                    <VibeScore score={user.vibe_score} size="sm" />
                  </td>
                  <td className="px-3 sm:px-4 py-3 text-right hidden sm:table-cell">
                    <StreakCounter streak={streakShown(user)} size="sm" />
                  </td>
                  <td className="px-3 sm:px-4 py-3 text-right text-sm font-bold text-[var(--text-secondary)] hidden sm:table-cell">
                    {(user.projects ?? []).length}
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

      {/* Pagination (count + eyebrow rendered inside) */}
      {sortedUsers.length > PAGE_SIZE && (
        <Pagination
          currentPage={activePage}
          totalPages={totalPages}
          onPageChange={goToPage}
          label="Leaderboard"
          pageSize={PAGE_SIZE}
          totalItems={sortedUsers.length}
          itemNoun="builders"
        />
      )}
    </>
  );
}
