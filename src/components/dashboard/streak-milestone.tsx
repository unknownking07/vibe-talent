"use client";

import { Flame, Target } from "lucide-react";

const MILESTONES = [7, 14, 30, 60, 100, 200, 365, 500, 1000];

const MOTIVATION_MESSAGES = [
  { min: 0, message: "Start your journey! Log your first activity." },
  { min: 1, message: "Keep the fire alive!" },
  { min: 7, message: "One week strong! You're building momentum." },
  { min: 14, message: "Two weeks in! Consistency is your superpower." },
  { min: 30, message: "A full month! You're proving you ship." },
  { min: 60, message: "Two months of grinding! Unstoppable." },
  { min: 100, message: "Triple digits! You're in the top tier." },
  { min: 200, message: "200 days! Legendary commitment." },
  { min: 365, message: "A full year! You are the definition of consistency." },
  { min: 500, message: "500 days! Absolute machine." },
];

function getMotivation(streak: number): string {
  let msg = MOTIVATION_MESSAGES[0].message;
  for (const m of MOTIVATION_MESSAGES) {
    if (streak >= m.min) msg = m.message;
  }
  return msg;
}

function getNextMilestone(streak: number): number | null {
  for (const m of MILESTONES) {
    if (streak < m) return m;
  }
  return null;
}

interface StreakMilestoneProps {
  streak: number;
}

export function StreakMilestone({ streak }: StreakMilestoneProps) {
  const nextMilestone = getNextMilestone(streak);
  const motivation = getMotivation(streak);

  // Previous milestone for progress calculation
  const prevMilestone = MILESTONES.filter((m) => m <= streak).pop() || 0;
  const progress = nextMilestone
    ? ((streak - prevMilestone) / (nextMilestone - prevMilestone)) * 100
    : 100;
  const remaining = nextMilestone ? nextMilestone - streak : 0;

  return (
    <div
      className="p-6 mb-8"
      style={{
        backgroundColor: "var(--bg-surface)",
        border: "2px solid var(--border-hard)",
        boxShadow: "var(--shadow-brutal)",
      }}
    >
      {/* Motivation Message */}
      <div className="mb-5">
        <h2
          className="text-2xl font-extrabold uppercase tracking-tight"
          style={{
            color: "var(--accent)",
          }}
        >
          <Flame className="inline-block mr-2 -mt-1" size={24} />
          {motivation}
        </h2>
        <p className="text-sm font-medium text-[var(--text-muted)] mt-1 uppercase tracking-wide">
          Log today&apos;s shipping activity to maintain your streak.
        </p>
      </div>

      {/* Next Milestone */}
      {nextMilestone && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Target size={16} className="text-[var(--text-muted)]" />
            <span className="text-xs font-extrabold uppercase tracking-wide text-[var(--foreground)]">
              Next Milestone
            </span>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <div
              className="w-3 h-3"
              style={{ backgroundColor: "var(--accent)" }}
            />
            <span className="text-3xl font-extrabold font-mono text-[var(--foreground)]">
              {nextMilestone} Days
            </span>
          </div>
          {/* Progress Bar */}
          <div
            className="w-full h-4 overflow-hidden"
            style={{
              backgroundColor: "var(--bg-surface-light)",
              border: "2px solid var(--border-hard)",
            }}
          >
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${Math.min(progress, 100)}%`,
                backgroundColor: "var(--accent)",
              }}
            />
          </div>
          <p className="text-xs font-extrabold uppercase tracking-wide text-[var(--foreground)] mt-2">
            {remaining} days remaining
          </p>
        </div>
      )}

      {!nextMilestone && (
        <p className="text-sm font-extrabold uppercase text-[var(--accent)]">
          You&apos;ve conquered all milestones! Keep shipping.
        </p>
      )}
    </div>
  );
}
