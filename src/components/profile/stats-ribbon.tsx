"use client";

import { Briefcase, Code, Fire, Lightning, Star } from "@phosphor-icons/react";

interface StatsRibbonProps {
  streak: number;
  vibeScore: number;
  projectCount: number;
  avgRating?: number;
  completedHires?: number;
}

export function StatsRibbon({ streak, vibeScore, projectCount, avgRating, completedHires }: StatsRibbonProps) {
  const hasOutcomes = (avgRating !== undefined && avgRating > 0) || (completedHires !== undefined && completedHires > 0);

  return (
    <div
      className={`grid ${hasOutcomes ? "grid-cols-3 sm:grid-cols-5" : "grid-cols-3"} rounded-2xl overflow-hidden`}
      style={{
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        boxShadow: "var(--shadow-brutal)",
      }}
    >
      {/* Streak */}
      <div
        className="flex items-center gap-3 px-5 py-4"
        style={{
          borderRight: "1px solid var(--border-subtle)",
        }}
      >
        <Fire weight="fill" size={20} style={{ color: "var(--accent)" }} />
        <div className="flex flex-col">
          <span
            className="font-mono font-extrabold text-[1.2rem] leading-tight"
            style={{ color: "var(--accent)" }}
          >
            {streak}
          </span>
          <span className="text-xs font-medium text-[var(--text-muted)]">Day Streak</span>
        </div>
      </div>

      {/* Vibe Score */}
      <div
        className="flex items-center gap-3 px-5 py-4"
        style={{
          borderRight: "1px solid var(--border-subtle)",
        }}
      >
        <Lightning weight="fill" size={20} style={{ color: "var(--accent)" }} />
        <div className="flex flex-col">
          <span
            className="font-mono font-extrabold text-[1.2rem] leading-tight"
            style={{ color: "var(--accent)" }}
          >
            {vibeScore.toLocaleString()}
          </span>
          <span className="text-xs font-medium text-[var(--text-muted)]">Vibe Score</span>
        </div>
      </div>

      {/* Projects */}
      <div
        className="flex items-center gap-3 px-5 py-4"
        style={{
          borderRight: hasOutcomes ? "1px solid var(--border-subtle)" : undefined,
        }}
      >
        <Code weight="fill" size={20} className="text-[var(--foreground)]" />
        <div className="flex flex-col">
          <span className="font-mono font-extrabold text-[1.2rem] leading-tight text-[var(--foreground)]">
            {projectCount}
          </span>
          <span className="text-xs font-medium text-[var(--text-muted)]">Projects</span>
        </div>
      </div>

      {/* Avg Rating — only shown if has reviews */}
      {avgRating !== undefined && avgRating > 0 && (
        <div
          className="flex items-center gap-3 px-5 py-4"
          style={{
            borderRight: "1px solid var(--border-subtle)",
          }}
        >
          <Star weight="fill" size={20} className="text-amber-500" />
          <div className="flex flex-col">
            <span className="font-mono font-extrabold text-[1.2rem] leading-tight text-amber-600">
              {avgRating}
            </span>
            <span className="text-xs font-medium text-[var(--text-muted)]">Avg Rating</span>
          </div>
        </div>
      )}

      {/* Completed Hires — only shown if has hires */}
      {completedHires !== undefined && completedHires > 0 && (
        <div className="flex items-center gap-3 px-5 py-4">
          <Briefcase weight="fill" size={20} className="text-emerald-600" />
          <div className="flex flex-col">
            <span className="font-mono font-extrabold text-[1.2rem] leading-tight text-emerald-600">
              {completedHires}
            </span>
            <span className="text-xs font-medium text-[var(--text-muted)]">Hires Done</span>
          </div>
        </div>
      )}
    </div>
  );
}
