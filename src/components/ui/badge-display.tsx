"use client";

import { getBadgeInfo } from "@/lib/streak";
import type { BadgeLevel } from "@/lib/types/database";

interface BadgeDisplayProps {
  level: BadgeLevel;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

const badgeColors: Record<string, { bg: string; text: string }> = {
  bronze: { bg: "#FEF3C7", text: "#92400E" },
  silver: { bg: "#F4F4F5", text: "#3F3F46" },
  gold: { bg: "#FEF9C3", text: "#854D0E" },
  diamond: { bg: "#CFFAFE", text: "#155E75" },
};

export function BadgeDisplay({ level, size = "md", showLabel = true }: BadgeDisplayProps) {
  const info = getBadgeInfo(level);

  if (level === "none") return null;

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-3 py-1",
    lg: "text-base px-4 py-1.5",
  };

  const colors = badgeColors[level] || { bg: "#F4F4F5", text: "#3F3F46" };

  return (
    <span
      className={`inline-flex items-center gap-1 font-extrabold uppercase tracking-wide ${sizeClasses[size]}`}
      style={{
        backgroundColor: colors.bg,
        color: colors.text,
        border: "1px solid #0F0F0F",
      }}
    >
      <span>{info.icon}</span>
      {showLabel && <span>{info.label}</span>}
    </span>
  );
}

export function AllBadges() {
  const levels: BadgeLevel[] = ["bronze", "silver", "gold", "diamond"];
  return (
    <div className="flex flex-wrap gap-2">
      {levels.map((level) => (
        <BadgeDisplay key={level} level={level} />
      ))}
    </div>
  );
}
