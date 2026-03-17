"use client";

import { useMemo } from "react";

interface ProfileHeatmapProps {
  data: Record<string, number>;
}

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

export function ProfileHeatmap({ data }: ProfileHeatmapProps) {
  const days = useMemo(() => {
    const result: { date: string; level: number }[] = [];
    const today = new Date();

    for (let i = 52 * 7 - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const key = date.toISOString().split("T")[0];
      const level = data[key] || 0;
      result.push({ date: key, level });
    }

    return result;
  }, [data]);

  return (
    <div
      className="grid gap-[3px] overflow-x-auto p-4"
      style={{
        gridTemplateColumns: "repeat(52, 1fr)",
        backgroundColor: "#F5F5F5",
        border: "2px solid #0F0F0F",
      }}
    >
      {days.map((day) => (
        <div
          key={day.date}
          title={`${day.date}: ${day.level} contributions`}
          style={{
            width: 12,
            height: 12,
            backgroundColor: getLevelColor(day.level),
            border: "1px solid #0F0F0F",
          }}
        />
      ))}
    </div>
  );
}
