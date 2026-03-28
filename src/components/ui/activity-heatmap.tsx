"use client";

import { useMemo } from "react";

interface ActivityHeatmapProps {
  data: Record<string, number>;
  totalOverride?: number;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

export function ActivityHeatmap({ data, totalOverride }: ActivityHeatmapProps) {
  const { weeks, monthLabels } = useMemo(() => {
    const result: { date: string; level: number; dayOfWeek: number }[][] = [];
    const today = new Date();

    // Go back to the start: 52 weeks ago, aligned to Sunday
    const start = new Date(today);
    start.setDate(start.getDate() - 363);
    // Align to the previous Sunday
    while (start.getDay() !== 0) {
      start.setDate(start.getDate() - 1);
    }

    let currentWeek: { date: string; level: number; dayOfWeek: number }[] = [];
    const current = new Date(start);

    while (current <= today) {
      const key = current.toISOString().split("T")[0];
      const level = data[key] || 0;
      currentWeek.push({ date: key, level, dayOfWeek: current.getDay() });

      if (currentWeek.length === 7) {
        result.push(currentWeek);
        currentWeek = [];
      }
      current.setDate(current.getDate() + 1);
    }
    if (currentWeek.length > 0) {
      result.push(currentWeek);
    }

    // Build month labels with column positions
    const labels: { label: string; col: number }[] = [];
    let lastMonth = -1;
    for (let wi = 0; wi < result.length; wi++) {
      // Use the first day of each week to determine month
      const firstDay = result[wi][0];
      const month = new Date(firstDay.date).getMonth();
      if (month !== lastMonth) {
        labels.push({ label: MONTHS[month], col: wi });
        lastMonth = month;
      }
    }

    return { weeks: result, monthLabels: labels };
  }, [data]);

  const getLevelColor = (level: number) => {
    switch (level) {
      case 0: return "var(--hm-0)";
      case 1: return "var(--hm-1)";
      case 2: return "var(--hm-2)";
      case 3: return "var(--hm-3)";
      default: return "var(--hm-4)";
    }
  };

  const totalContributions = totalOverride ?? Object.values(data).reduce((sum, v) => sum + (v > 0 ? v : 0), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wide">
          {totalContributions} contributions in the last year
        </h3>
        <div className="flex items-center gap-1 text-xs font-bold text-[var(--text-muted)] uppercase">
          <span>Less</span>
          {[0, 1, 2, 3, 4].map((level) => (
            <div
              key={level}
              className="w-3 h-3"
              style={{
                backgroundColor: getLevelColor(level),
                border: "1px solid var(--border-subtle)",
              }}
            />
          ))}
          <span>More</span>
        </div>
      </div>

      <div className="overflow-x-auto pb-2">
        {/* Month labels */}
        <div className="flex" style={{ paddingLeft: 32, marginBottom: 4 }}>
          {monthLabels.map((m, i) => {
            const nextCol = i < monthLabels.length - 1 ? monthLabels[i + 1].col : weeks.length;
            const span = nextCol - m.col;
            return (
              <div
                key={`${m.label}-${m.col}`}
                className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]"
                style={{ width: span * 15, flexShrink: 0 }}
              >
                {m.label}
              </div>
            );
          })}
        </div>

        {/* Grid with day labels */}
        <div className="flex">
          {/* Day labels column */}
          <div className="flex flex-col gap-[3px] mr-1" style={{ width: 28 }}>
            {DAY_LABELS.map((label, i) => (
              <div
                key={i}
                className="h-3 flex items-center text-[10px] font-bold text-[var(--text-muted)]"
              >
                {label}
              </div>
            ))}
          </div>

          {/* Heatmap cells */}
          <div className="flex gap-[3px]">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                {week.map((day) => (
                  <div
                    key={day.date}
                    className="w-3 h-3"
                    style={{
                      backgroundColor: getLevelColor(day.level),
                      border: "1px solid var(--border-subtle)",
                    }}
                    title={`${day.date}: ${day.level > 0 ? day.level : "No"} contributions`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
