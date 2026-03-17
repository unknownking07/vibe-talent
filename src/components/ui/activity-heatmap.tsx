"use client";

import { useMemo } from "react";

interface ActivityHeatmapProps {
  data: Record<string, number>;
}

export function ActivityHeatmap({ data }: ActivityHeatmapProps) {
  const weeks = useMemo(() => {
    const result: { date: string; level: number }[][] = [];
    const today = new Date();
    let currentWeek: { date: string; level: number }[] = [];

    for (let i = 363; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const key = date.toISOString().split("T")[0];
      const level = data[key] || 0;

      currentWeek.push({ date: key, level });

      if (currentWeek.length === 7) {
        result.push(currentWeek);
        currentWeek = [];
      }
    }

    if (currentWeek.length > 0) {
      result.push(currentWeek);
    }

    return result;
  }, [data]);

  const getLevelColor = (level: number) => {
    switch (level) {
      case 0: return "var(--hm-0)";
      case 1: return "var(--hm-1)";
      case 2: return "var(--hm-2)";
      case 3: return "var(--hm-3)";
      case 4: return "var(--hm-4)";
      default: return "var(--hm-0)";
    }
  };

  const totalActivities = Object.values(data).reduce((sum, v) => sum + v, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-[#52525B] uppercase tracking-wide">
          {totalActivities} contributions in the last year
        </h3>
        <div className="flex items-center gap-1 text-xs font-bold text-[#71717A] uppercase">
          <span>Less</span>
          {[0, 1, 2, 3, 4].map((level) => (
            <div
              key={level}
              className="w-3 h-3"
              style={{
                backgroundColor: getLevelColor(level),
                border: "1px solid #0F0F0F",
              }}
            />
          ))}
          <span>More</span>
        </div>
      </div>
      <div className="flex gap-[3px] overflow-x-auto pb-2">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {week.map((day) => (
              <div
                key={day.date}
                className="w-3 h-3"
                style={{
                  backgroundColor: getLevelColor(day.level),
                  border: "1px solid #0F0F0F",
                }}
                title={`${day.date}: ${day.level} contributions`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
