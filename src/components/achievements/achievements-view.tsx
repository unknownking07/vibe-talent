"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Play } from "lucide-react";
import { AchievementsGrid } from "@/components/achievements/achievements-grid";
import { AchievementCelebration } from "@/components/achievements/achievement-celebration";
import type { AchievementView } from "@/lib/achievements/definitions";

interface AchievementsViewProps {
  achievements: AchievementView[];
  username: string;
}

const ACCENT = "#FF3A00";

/**
 * Interactive achievements experience: animated header counter, a grid of
 * badges where tapping an earned one replays its unlock celebration, and a
 * "simulate" preview. The server passes already-computed, serializable state.
 */
export function AchievementsView({ achievements, username }: AchievementsViewProps) {
  const totalCount = achievements.length;
  const earnedCount = useMemo(
    () => achievements.filter((a) => a.earned).length,
    [achievements],
  );

  // The badge to preview when "Simulate unlock" is pressed: the locked badge
  // closest to unlocking, or — if everything's earned — the last one, so the
  // button always has something celebratory to show.
  const simTarget = useMemo<AchievementView | null>(() => {
    const locked = achievements.filter((a) => !a.earned);
    if (locked.length) {
      return locked.reduce((best, a) => (a.percent > best.percent ? a : best));
    }
    return achievements.length ? achievements[achievements.length - 1] : null;
  }, [achievements]);

  const [celebrating, setCelebrating] = useState<AchievementView | null>(null);

  // Resting fill of the header bar (0–1). The fill animates up to this purely
  // in CSS (GPU transform) and the tally counts up in its own isolated
  // component — so the intro animation never re-renders this view per frame.
  const ratio = totalCount > 0 ? earnedCount / totalCount : 0;

  return (
    <>
      {/* Header card */}
      <section
        className="relative overflow-hidden p-6"
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "2px solid var(--border-hard)",
          boxShadow: "var(--shadow-brutal)",
        }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute"
          style={{
            top: -60,
            right: -40,
            width: 280,
            height: 280,
            background:
              "radial-gradient(circle, rgba(255,58,0,0.16), transparent 70%)",
          }}
        />
        <div className="relative flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <h1
                className="text-3xl font-extrabold uppercase leading-none tracking-wide sm:text-[2.5rem]"
                style={{ color: "var(--foreground)" }}
              >
                Achievements
              </h1>
              <p
                className="text-sm font-medium"
                style={{ color: "var(--text-secondary)" }}
              >
                Badges earned by{" "}
                <span style={{ color: "var(--foreground)", fontWeight: 700 }}>
                  @{username}
                </span>
              </p>
            </div>
            <div className="flex flex-col items-start gap-0.5 sm:items-end">
              <div
                className="font-mono text-4xl font-extrabold leading-none tabular-nums sm:text-[2.875rem]"
                style={{ color: "var(--foreground)" }}
              >
                <CountUp target={earnedCount} />
                <span style={{ color: "var(--text-muted)" }}> / {totalCount}</span>
              </div>
              <div
                className="text-[11px] font-extrabold uppercase tracking-[0.14em]"
                style={{ color: "var(--text-secondary)" }}
              >
                Unlocked
              </div>
            </div>
          </div>

          <ProgressBar
            ratio={ratio}
            earnedCount={earnedCount}
            totalCount={totalCount}
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            {earnedCount > 0 ? (
              <span
                className="text-xs font-medium"
                style={{ color: "var(--text-secondary)" }}
              >
                Tap any earned badge to replay its unlock celebration.
              </span>
            ) : (
              <span
                className="text-xs font-medium"
                style={{ color: "var(--text-secondary)" }}
              >
                Earn your first badge to start your collection.
              </span>
            )}
            {simTarget ? (
              <button
                type="button"
                onClick={() => setCelebrating(simTarget)}
                className="btn-brutal"
                style={{
                  padding: "10px 18px",
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "#fff",
                  background: ACCENT,
                  border: "2px solid #0F0F0F",
                  boxShadow: "3px 3px 0 #000",
                }}
              >
                <Play size={14} fill="currentColor" stroke="none" />
                Simulate unlock
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <AchievementsGrid
        achievements={achievements}
        username={username}
        onCelebrate={setCelebrating}
      />

      {celebrating ? (
        <AchievementCelebration
          achievement={celebrating}
          username={username}
          accent={ACCENT}
          onClose={() => setCelebrating(null)}
        />
      ) : null}
    </>
  );
}

/**
 * Counts from 0 up to `target` on mount by writing textContent directly in a
 * rAF loop — no setState, so it triggers zero React re-renders while animating.
 * Honors prefers-reduced-motion (jumps straight to the final value).
 */
function CountUp({ target }: { target: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      el.textContent = String(target);
      return;
    }
    let raf = 0;
    const dur = 950;
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      el.textContent = String(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return <span ref={ref}>{target}</span>;
}

/**
 * Header progress fill that grows from empty on mount via a single GPU-composited
 * transform transition (declared inline — no global-stylesheet dependency, no
 * per-frame JS or layout reflow). Honors prefers-reduced-motion.
 */
function ProgressBar({
  ratio,
  earnedCount,
  totalCount,
}: {
  ratio: number;
  earnedCount: number;
  totalCount: number;
}) {
  // React owns the transform via state (so it's never fought by reconciliation).
  // One state flip on mount drives a single GPU-composited transform transition
  // — no per-frame JS, no layout reflow.
  const [fill, setFill] = useState(0);
  const [instant, setInstant] = useState(false);
  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const raf = requestAnimationFrame(() => {
      if (reduced) setInstant(true);
      setFill(ratio);
    });
    return () => cancelAnimationFrame(raf);
  }, [ratio]);

  return (
    <div
      className="h-3.5 w-full overflow-hidden"
      style={{
        backgroundColor: "var(--bg-base, var(--background))",
        border: "2px solid var(--border-hard)",
      }}
      role="progressbar"
      aria-label="Achievements unlocked"
      aria-valuemin={0}
      aria-valuemax={totalCount}
      aria-valuenow={earnedCount}
    >
      <div
        className="h-full w-full"
        style={{
          transform: `scaleX(${fill})`,
          transformOrigin: "left center",
          transition: instant
            ? "none"
            : "transform 0.95s cubic-bezier(0.2, 0.8, 0.2, 1)",
          background: "linear-gradient(90deg, #F0B400, #FFD24A)",
        }}
      />
    </div>
  );
}
