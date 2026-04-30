"use client";

import { useMemo, useState, useEffect, useLayoutEffect, useRef } from "react";

interface ProfileHeatmapProps {
  data: Record<string, number>;
  githubUsername?: string | null;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

const getLevelColor = (level: number) => {
  switch (level) {
    case 0: return "var(--hm-0)";
    case 1: return "var(--hm-1)";
    case 2: return "var(--hm-2)";
    case 3: return "var(--hm-3)";
    default: return "var(--hm-4)";
  }
};

// Bucket a real per-day commit count into a 0-4 color intensity. Mirrors the
// shape of GitHub's own contribution calendar buckets so the visual feel is
// familiar (low/med/high days look low/med/high).
const countToLevel = (count: number) => {
  if (count <= 0) return 0;
  if (count < 3) return 1;
  if (count < 8) return 2;
  if (count < 20) return 3;
  return 4;
};

export function ProfileHeatmap({ data, githubUsername }: ProfileHeatmapProps) {
  const [ghData, setGhData] = useState<Record<string, number>>({});
  const [ghTotal, setGhTotal] = useState<number>(0);

  useEffect(() => {
    if (!githubUsername) return;
    const cleanName = githubUsername
      .replace(/^@/, "")
      .replace(/^https?:\/\/(www\.)?github\.com\//, "")
      .replace(/\/+$/, "")
      .trim();
    if (!cleanName) return;

    fetch(`/api/github/contributions?github=${encodeURIComponent(cleanName)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!json?.contributions) return;
        if (Object.keys(json.contributions).length > 0) {
          setGhData(json.contributions);
        }
        if (json.total) {
          setGhTotal(json.total);
        }
      })
      .catch(() => {});
  }, [githubUsername]);

  // Merge: GitHub data as base, streak_logs overlay (higher value wins)
  const mergedData = useMemo(() => {
    const merged = { ...ghData };
    for (const [date, level] of Object.entries(data)) {
      if (!merged[date] || level > merged[date]) {
        merged[date] = level;
      }
    }
    return merged;
  }, [data, ghData]);

  const { weeks, monthLabels } = useMemo(() => {
    const result: { date: string; count: number }[][] = [];
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - 363);
    while (start.getDay() !== 0) start.setDate(start.getDate() - 1);

    let currentWeek: { date: string; count: number }[] = [];
    const current = new Date(start);
    while (current <= today) {
      const key = current.toISOString().split("T")[0];
      currentWeek.push({ date: key, count: mergedData[key] || 0 });
      if (currentWeek.length === 7) {
        result.push(currentWeek);
        currentWeek = [];
      }
      current.setDate(current.getDate() + 1);
    }
    if (currentWeek.length > 0) result.push(currentWeek);

    const labels: { label: string; col: number }[] = [];
    let lastMonth = -1;
    for (let wi = 0; wi < result.length; wi++) {
      const month = new Date(result[wi][0].date).getMonth();
      if (month !== lastMonth) {
        labels.push({ label: MONTHS[month], col: wi });
        lastMonth = month;
      }
    }
    return { weeks: result, monthLabels: labels };
  }, [mergedData]);

  // Use GitHub's actual total when available; fall back to counting active days
  const total = ghTotal > 0 ? ghTotal : Object.values(mergedData).reduce((sum, v) => sum + (v > 0 ? v : 0), 0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const hasScrolledRef = useRef(false);
  useLayoutEffect(() => {
    if (scrollRef.current && !hasScrolledRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
      hasScrolledRef.current = true;
    }
  }, [weeks]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wide">
          {total} contributions in the last year
        </span>
        <div className="flex items-center gap-1 text-xs font-bold text-[var(--text-muted)] uppercase">
          <span>Less</span>
          {[0, 1, 2, 3, 4].map((level) => (
            <div
              key={level}
              className="w-3 h-3"
              style={{ backgroundColor: getLevelColor(level), border: "1px solid var(--border-subtle)" }}
            />
          ))}
          <span>More</span>
        </div>
      </div>
      <div ref={scrollRef} className="overflow-x-auto pb-2">
        <div className="flex" style={{ paddingLeft: 32, marginBottom: 4 }}>
          {monthLabels.map((m, i) => {
            const nextCol = i < monthLabels.length - 1 ? monthLabels[i + 1].col : weeks.length;
            return (
              <div
                key={`${m.label}-${m.col}`}
                className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]"
                style={{ width: (nextCol - m.col) * 15, flexShrink: 0 }}
              >
                {m.label}
              </div>
            );
          })}
        </div>
        <div className="flex">
          <div className="flex flex-col gap-[3px] mr-1" style={{ width: 28 }}>
            {DAY_LABELS.map((label, i) => (
              <div key={i} className="h-3 flex items-center text-[10px] font-bold text-[var(--text-muted)]">
                {label}
              </div>
            ))}
          </div>
          <div className="flex gap-[3px]">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                {week.map((day) => (
                  <div
                    key={day.date}
                    className="w-3 h-3"
                    style={{ backgroundColor: getLevelColor(countToLevel(day.count)), border: "1px solid var(--border-subtle)" }}
                    title={day.count > 0
                      ? `${day.count} ${day.count === 1 ? "contribution" : "contributions"} on ${day.date}`
                      : `No contributions on ${day.date}`}
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
