"use client";

import { Flame, Zap, Code2, Star, Briefcase } from "lucide-react";

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
      className={`grid ${hasOutcomes ? "grid-cols-3 sm:grid-cols-5" : "grid-cols-3"} overflow-x-auto`}
      style={{
        border: "2px solid #0F0F0F",
        boxShadow: "var(--shadow-brutal)",
      }}
    >
      {/* Streak */}
      <div
        className="flex items-center gap-3 px-5 py-4"
        style={{
          backgroundColor: "#FFFFFF",
          borderRight: "2px solid #0F0F0F",
        }}
      >
        <Flame size={20} style={{ color: "var(--accent)" }} />
        <div className="flex flex-col">
          <span
            className="font-mono font-extrabold text-[1.2rem] leading-tight"
            style={{ color: "var(--accent)" }}
          >
            {streak}
          </span>
          <span className="text-xs font-bold text-[#71717A] uppercase tracking-wider">Day Streak</span>
        </div>
      </div>

      {/* Vibe Score */}
      <div
        className="flex items-center gap-3 px-5 py-4"
        style={{
          backgroundColor: "#FFFFFF",
          borderRight: "2px solid #0F0F0F",
        }}
      >
        <Zap size={20} style={{ color: "var(--accent)" }} />
        <div className="flex flex-col">
          <span
            className="font-mono font-extrabold text-[1.2rem] leading-tight"
            style={{ color: "var(--accent)" }}
          >
            {vibeScore.toLocaleString()}
          </span>
          <span className="text-xs font-bold text-[#71717A] uppercase tracking-wider">Vibe Score</span>
        </div>
      </div>

      {/* Projects */}
      <div
        className="flex items-center gap-3 px-5 py-4"
        style={{
          backgroundColor: "#FFFFFF",
          borderRight: hasOutcomes ? "2px solid #0F0F0F" : undefined,
        }}
      >
        <Code2 size={20} className="text-[#0F0F0F]" />
        <div className="flex flex-col">
          <span className="font-mono font-extrabold text-[1.2rem] leading-tight text-[#0F0F0F]">
            {projectCount}
          </span>
          <span className="text-xs font-bold text-[#71717A] uppercase tracking-wider">Projects</span>
        </div>
      </div>

      {/* Avg Rating — only shown if has reviews */}
      {avgRating !== undefined && avgRating > 0 && (
        <div
          className="flex items-center gap-3 px-5 py-4"
          style={{
            backgroundColor: "#FFFFFF",
            borderRight: "2px solid #0F0F0F",
          }}
        >
          <Star size={20} className="text-amber-500" />
          <div className="flex flex-col">
            <span className="font-mono font-extrabold text-[1.2rem] leading-tight text-amber-600">
              {avgRating}
            </span>
            <span className="text-xs font-bold text-[#71717A] uppercase tracking-wider">Avg Rating</span>
          </div>
        </div>
      )}

      {/* Completed Hires — only shown if has hires */}
      {completedHires !== undefined && completedHires > 0 && (
        <div
          className="flex items-center gap-3 px-5 py-4"
          style={{ backgroundColor: "#FFFFFF" }}
        >
          <Briefcase size={20} className="text-emerald-600" />
          <div className="flex flex-col">
            <span className="font-mono font-extrabold text-[1.2rem] leading-tight text-emerald-600">
              {completedHires}
            </span>
            <span className="text-xs font-bold text-[#71717A] uppercase tracking-wider">Hires Done</span>
          </div>
        </div>
      )}
    </div>
  );
}
