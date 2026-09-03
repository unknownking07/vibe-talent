"use client";

import { useEffect, useRef, useState } from "react";
import type { HeroStats } from "@/lib/supabase/server-queries";

/**
 * The stat strip under the proof wall.
 *
 * Server-rendered from the same counts on first paint (so the numbers are in
 * the HTML for crawlers and there's no empty flash), then polled so a signup
 * or a shipped project shows up without the visitor reloading the page. The
 * poll pauses while the tab is hidden and re-syncs on focus — same contract as
 * the network feed, for the same reason: background tabs shouldn't burn
 * Supabase egress on numbers nobody is looking at.
 */

const POLL_INTERVAL = 60_000;

/** Guards the response before it replaces good numbers with `undefined`. */
function isHeroStats(value: unknown): value is HeroStats {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.totalBuilderDays === "number" &&
    typeof v.longestStreak === "number" &&
    typeof v.buildersTracked === "number" &&
    typeof v.totalProjects === "number" &&
    typeof v.avgStreak === "number"
  );
}

export function ProofWallStats({ initial }: { initial: HeroStats }) {
  const [stats, setStats] = useState<HeroStats>(initial);

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    const fetchStats = async () => {
      try {
        const res = await fetch("/api/hero-stats");
        // Non-2xx bodies are the rate-limit / failure shapes, not stats.
        // Keeping the last good numbers beats blanking the strip mid-poll.
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && isHeroStats(data)) setStats(data);
      } catch {
        // Network errors are swallowed; the rendered numbers stay put.
      }
    };

    const startPolling = () => {
      if (interval !== null) return;
      interval = setInterval(fetchStats, POLL_INTERVAL);
    };
    const stopPolling = () => {
      if (interval === null) return;
      clearInterval(interval);
      interval = null;
    };
    const onVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        fetchStats();
        startPolling();
      }
    };

    // One fetch on mount: the page itself is ISR-cached for minutes, so this
    // is what pulls a stale strip up to date on arrival.
    fetchStats();
    startPolling();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      stopPolling();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  // Every figure here is a live count. Deliberately absent: the old
  // "Top Vibers" tile, which rendered topVibecoders.length against an array
  // hardcoded to .slice(0, 3) — it read "3" no matter what the data did.
  //
  // Also deliberate: no stat is accent-coloured, not even on a tick. The hero
  // is single-colour text by design, so the only accent above the fold is the
  // primary button. "Builders tracked" used to carry an `accent: true` flag;
  // don't put it back without changing that rule too — which is why the update
  // animation is motion (roll + lift) rather than colour.
  const items = [
    // Wording matters on the first tile. Roughly half of streak_logs predates
    // the platform (the github-sync backfill reads a year of contribution
    // history), so "days verified" implied activity ON VibeTalent that those
    // rows cannot support. "GitHub-verified days" is what the number actually
    // is: commit days read from GitHub rather than self-reported.
    { label: "GitHub-verified days", value: stats.totalBuilderDays },
    { label: "Longest streak", value: stats.longestStreak, suffix: "days" },
    { label: "Builders tracked", value: stats.buildersTracked },
    { label: "Projects shipped", value: stats.totalProjects },
    {
      label: "Avg. streak",
      value: stats.avgStreak,
      suffix: stats.avgStreak === 1 ? "day" : "days",
    },
  ];

  return (
    <div className="flex flex-wrap gap-x-10 gap-y-6">
      {items.map((s) => (
        <Stat key={s.label} label={s.label} value={s.value} suffix={s.suffix} />
      ))}
    </div>
  );
}

function Stat({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </div>
      <div className="mt-1 text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--foreground)]">
        <RollingNumber value={value} />
        {suffix && (
          <span className="ml-1.5 text-base font-bold text-[var(--text-muted)]">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

/**
 * A number whose digits roll to their new value.
 *
 * Each digit is a masked column holding 0-9, so a change is one transform per
 * changed digit — 205 -> 206 rolls only the ones column, and nothing else on
 * the strip moves. Layout and baseline come from a real, in-flow copy of the
 * text (transparent, still readable by screen readers and still selectable);
 * the columns are absolutely positioned over it, which is what keeps the
 * masked boxes from dragging the baseline off the "days" suffix beside them.
 *
 * Columns are keyed from the right so the ones column keeps its identity when
 * the number gains a digit (99 -> 100) and rolls instead of being remounted —
 * which also gives each column its place in the cascade: the ones column moves
 * first and each column left of it follows a beat later, the way a counter
 * carries. Capped at four beats so a long number doesn't drag.
 *
 * A change also fires a one-shot lift on the whole figure, so an update that
 * only moves the last digit (205 -> 206) still reads as an event.
 */
function RollingNumber({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(value);

  // The lift runs straight on the DOM node rather than through state: it's a
  // one-shot flourish, so re-rendering the strip for it (twice — on and off)
  // would be pure waste. Skipped on mount, since `prev` starts at `value`.
  //
  // Web Animations rather than a CSS class because the class has to be taken
  // off again, and every signal for "it's over" is unreliable in a tab that
  // isn't being painted: `animationend` never arrives there, and the class
  // sticks. An Animation object owns its own lifetime and the cleanup cancels
  // it, so a second update restarts the lift instead of stacking on it.
  useEffect(() => {
    if (prev.current === value) return;
    prev.current = value;
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lift = el.animate(
      [
        { transform: "none" },
        { transform: "translateY(-2px) scale(1.045)", offset: 0.35 },
        { transform: "none" },
      ],
      // Duration and curve match the digit roll below (--ease-out), so the
      // lift and the roll land together.
      { duration: 600, easing: "cubic-bezier(0.23, 1, 0.32, 1)" }
    );
    return () => lift.cancel();
  }, [value]);

  const text = value.toLocaleString("en-US");
  const chars = text.split("");

  return (
    <span className="stat-roll" ref={ref}>
      <span className="stat-roll-ghost">{text}</span>
      <span className="stat-roll-track" aria-hidden="true">
        {chars.map((ch, i) => {
          const fromRight = chars.length - 1 - i;
          const digit = DIGITS.indexOf(ch);
          if (digit === -1) {
            return (
              <span key={fromRight} className="stat-roll-sep">
                {ch}
              </span>
            );
          }
          return (
            <span key={fromRight} className="stat-roll-col">
              <span
                className="stat-roll-strip"
                style={{
                  transform: `translateY(-${digit * 10}%)`,
                  transitionDelay: `${Math.min(fromRight, 3) * 45}ms`,
                }}
              >
                {DIGITS.map((d) => (
                  <span key={d} className="stat-roll-cell">
                    {d}
                  </span>
                ))}
              </span>
            </span>
          );
        })}
      </span>
    </span>
  );
}
