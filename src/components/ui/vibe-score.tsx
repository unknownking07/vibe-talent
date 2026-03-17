"use client";

import { Zap } from "lucide-react";

interface VibeScoreProps {
  score: number;
  size?: "sm" | "md" | "lg";
}

export function VibeScore({ score, size = "md" }: VibeScoreProps) {
  const sizeConfig = {
    sm: { icon: 14, text: "text-sm" },
    md: { icon: 18, text: "text-lg" },
    lg: { icon: 24, text: "text-2xl" },
  };

  const config = sizeConfig[size];

  return (
    <div className="inline-flex items-center gap-1.5 text-[var(--accent)]">
      <Zap size={config.icon} className="fill-[var(--accent)]" />
      <span className={`font-extrabold ${config.text} font-mono`}>{score}</span>
    </div>
  );
}
