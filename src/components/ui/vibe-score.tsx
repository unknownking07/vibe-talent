"use client";

import { Lightning } from "@phosphor-icons/react";


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
      <Lightning size={config.icon} weight="fill" />
      <span className={`font-extrabold ${config.text} font-mono`}>{score}</span>
    </div>
  );
}
