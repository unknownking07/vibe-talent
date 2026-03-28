"use client";

import { Flame } from "lucide-react";

interface StreakCounterProps {
  streak: number;
  size?: "sm" | "md" | "lg";
}

export function StreakCounter({ streak, size = "md" }: StreakCounterProps) {
  const sizeConfig = {
    sm: { icon: 14, text: "text-sm" },
    md: { icon: 18, text: "text-lg" },
    lg: { icon: 24, text: "text-2xl" },
  };

  const config = sizeConfig[size];
  const isActive = streak > 0;

  return (
    <div
      className={`inline-flex items-center gap-1.5 ${
        isActive ? "text-[var(--accent)]" : "text-[var(--text-muted-soft)]"
      }`}
    >
      <Flame
        size={config.icon}
        className={isActive ? "fill-[var(--accent)]" : ""}
      />
      <span className={`font-extrabold ${config.text} font-mono`}>{streak}</span>
    </div>
  );
}
