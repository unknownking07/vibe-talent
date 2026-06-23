"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Play, Share2, X } from "lucide-react";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
} from "@/lib/achievements/definitions";
import { getBadgeArt } from "@/lib/achievements/badge-art";
import { BadgeMedallion } from "@/components/achievements/badge-medallion";
import {
  AchievementCard,
  type AchievementView,
} from "@/components/achievements/achievement-card";

interface AchievementsExperienceProps {
  achievements: AchievementView[];
  username: string;
  earnedCount: number;
  totalCount: number;
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function AchievementsExperience({
  achievements,
  username,
  earnedCount,
  totalCount,
}: AchievementsExperienceProps) {
  const overallPercent =
    totalCount > 0 ? Math.round((earnedCount / totalCount) * 100) : 0;

  // Count-up + bar fill on mount.
  const [t, setT] = useState(0);
  useEffect(() => {
    if (prefersReducedMotion()) {
      setT(1);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const dur = 950;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      setT(1 - Math.pow(1 - p, 3));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  const displayedEarned = Math.round(earnedCount * t);
  const headerBarWidth = `${overallPercent * t}%`;

  const groups = useMemo(
    () =>
      CATEGORY_ORDER.map((cat) => ({
        cat,
        items: achievements.filter((a) => a.category === cat),
      })).filter((g) => g.items.length > 0),
    [achievements],
  );

  // Most-progressed locked achievement — the one "Simulate Unlock" previews.
  const simTarget = useMemo(() => {
    let best: AchievementView | null = null;
    for (const a of achievements) {
      if (!a.earned && (best === null || a.percent > best.percent)) best = a;
    }
    return best ?? achievements.find((a) => a.earned) ?? achievements[0] ?? null;
  }, [achievements]);

  // ── Celebration modal ──────────────────────────────────────────────
  const [celebration, setCelebration] = useState<AchievementView | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const confRaf = useRef(0);

  const launchConfetti = useCallback(() => {
    cancelAnimationFrame(confRaf.current);
    if (prefersReducedMotion()) return;
    const cv = canvasRef.current;
    if (!cv) return;
    const rect = cv.getBoundingClientRect();
    const W = (cv.width = rect.width);
    const H = (cv.height = rect.height);
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const colors = ["#FF3A00", "#F0B400", "#10B981", "#0EA5E9", "#EC4899", "#FFFFFF"];
    const cx = W / 2;
    const cy = H * 0.42;
    const parts: Array<{
      x: number; y: number; vx: number; vy: number; rot: number; vr: number;
      w: number; h: number; color: string; strip: boolean;
    }> = [];
    for (let i = 0; i < 170; i++) {
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.5;
      const sp = 5 + Math.random() * 13;
      parts.push({
        x: cx + (Math.random() - 0.5) * 60,
        y: cy,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp,
        rot: Math.random() * 6.28,
        vr: (Math.random() - 0.5) * 0.4,
        w: 6 + Math.random() * 8,
        h: 9 + Math.random() * 10,
        color: colors[(Math.random() * colors.length) | 0],
        strip: Math.random() > 0.6,
      });
    }
    let frame = 0;
    const tick = () => {
      ctx.clearRect(0, 0, W, H);
      let alive = 0;
      for (const p of parts) {
        p.vy += 0.2;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        const a = frame < 95 ? 1 : Math.max(0, 1 - (frame - 95) / 75);
        if (a <= 0 || p.y > H + 30) continue;
        alive++;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.strip) ctx.fillRect(-1.5, -p.h / 2, 3, p.h);
        else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      frame++;
      if (frame < 175 && alive > 0) confRaf.current = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, W, H);
    };
    confRaf.current = requestAnimationFrame(tick);
  }, []);

  const openCelebration = useCallback(
    (item: AchievementView | null) => {
      if (!item) return;
      setCelebration(item);
    },
    [],
  );

  const close = useCallback(() => {
    cancelAnimationFrame(confRaf.current);
    setCelebration(null);
  }, []);

  // Fire confetti once the modal has mounted; lock body scroll; wire Esc.
  useEffect(() => {
    if (!celebration) return;
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => launchConfetti()),
    );
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onEsc);
    return () => {
      cancelAnimationFrame(id);
      cancelAnimationFrame(confRaf.current);
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onEsc);
    };
  }, [celebration, launchConfetti, close]);

  const celArt = celebration ? getBadgeArt(celebration.id) : null;

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
              "radial-gradient(circle, rgba(255,58,0,.16), transparent 70%)",
          }}
        />
        <div className="relative flex flex-col gap-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <h1
                className="text-3xl font-extrabold uppercase tracking-wide"
                style={{ color: "var(--foreground)" }}
              >
                Achievements
              </h1>
              <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                Badges earned by{" "}
                <span className="font-extrabold" style={{ color: "var(--foreground)" }}>
                  @{username}
                </span>
              </p>
            </div>
            <div className="flex flex-col items-start gap-0.5 sm:items-end">
              <div
                className="font-mono text-4xl font-extrabold leading-none tabular-nums"
                style={{ color: "var(--foreground)", letterSpacing: "-0.02em" }}
              >
                {displayedEarned}
                <span style={{ color: "var(--text-muted)" }}> / {totalCount}</span>
              </div>
              <div
                className="text-[11px] font-extrabold uppercase"
                style={{ color: "var(--text-secondary)", letterSpacing: "0.14em" }}
              >
                Unlocked
              </div>
            </div>
          </div>

          <div
            className="h-3.5 w-full overflow-hidden"
            style={{
              backgroundColor: "var(--bg-base)",
              border: "2px solid var(--border-hard)",
            }}
          >
            <div
              className="h-full"
              style={{
                width: headerBarWidth,
                background: "linear-gradient(90deg, #F0B400, #FFD24A)",
                transition: "width .3s ease-out",
                boxShadow: "inset 0 0 0 1px rgba(0,0,0,.2)",
              }}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
              Tap any earned badge to replay its unlock celebration.
            </span>
            <button
              type="button"
              onClick={() => openCelebration(simTarget)}
              className="ach-btn inline-flex items-center gap-2 px-4 py-2.5 text-xs font-extrabold uppercase tracking-wide"
              style={{
                color: "#FFFFFF",
                backgroundColor: "var(--accent, #FF3A00)",
                border: "2px solid var(--border-hard)",
                boxShadow: "var(--shadow-brutal-xs)",
              }}
            >
              <Play size={14} fill="currentColor" stroke="none" />
              Simulate Unlock
            </button>
          </div>
        </div>
      </section>

      {/* Grouped grid */}
      <div className="flex flex-col gap-8">
        {groups.map(({ cat, items }) => {
          const earnedInCat = items.filter((i) => i.earned).length;
          return (
            <section key={cat} className="flex flex-col gap-3">
              <div
                className="flex items-baseline justify-between pb-2"
                style={{ borderBottom: "2px solid var(--border-subtle)" }}
              >
                <h2
                  className="text-base font-extrabold uppercase tracking-wide"
                  style={{ color: "var(--foreground)" }}
                >
                  {CATEGORY_LABELS[cat]}
                </h2>
                <span
                  className="text-xs font-bold uppercase tracking-wide"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {earnedInCat} / {items.length} unlocked
                </span>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((a) => (
                  <AchievementCard
                    key={a.id}
                    achievement={a}
                    username={username}
                    onCelebrate={() => openCelebration(a)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/* Celebration modal */}
      {celebration && celArt ? (
        <div
          className="ach-scrim fixed inset-0 z-[200] flex items-center justify-center"
          style={{ background: "rgba(8,6,5,.86)", backdropFilter: "blur(3px)" }}
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label={`${celebration.title} unlocked`}
        >
          <canvas
            ref={canvasRef}
            className="pointer-events-none absolute inset-0 z-[3] h-full w-full"
          />
          <div
            className="relative z-[2] flex max-w-[540px] flex-col items-center p-10 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Decorative splat glows */}
            <div
              aria-hidden="true"
              className="ach-spray pointer-events-none absolute"
              style={{
                top: -10,
                left: "50%",
                transform: "translateX(-50%)",
                width: 340,
                height: 340,
                background: "radial-gradient(circle, rgba(255,58,0,.28), transparent 65%)",
              }}
            />
            <div
              aria-hidden="true"
              className="ach-splat pointer-events-none absolute"
              style={{
                ["--r" as string]: "-16deg",
                top: 30,
                left: 60,
                width: 120,
                height: 120,
                background: "radial-gradient(circle, #F0B400, transparent 62%)",
                filter: "blur(2px)",
                animationDelay: ".05s",
              }}
            />
            <div
              aria-hidden="true"
              className="ach-splat pointer-events-none absolute"
              style={{
                ["--r" as string]: "20deg",
                top: 50,
                right: 54,
                width: 110,
                height: 110,
                background: "radial-gradient(circle, #10B981, transparent 62%)",
                filter: "blur(2px)",
                animationDelay: ".12s",
              }}
            />

            <div className="ach-pop relative z-[1]">
              <BadgeMedallion
                paletteKey={celArt.palette}
                icon={celArt.icon}
                chipLabel={celArt.chipLabel}
                size={150}
                earned
                float
              />
            </div>
            <div
              className="ach-up relative z-[1] mt-8 font-mono text-[13px] font-extrabold uppercase"
              style={{ color: "var(--accent, #FF3A00)", letterSpacing: "0.3em", animationDelay: ".18s" }}
            >
              Achievement Unlocked
            </div>
            <h2
              className="ach-up relative z-[1] mt-2.5 text-4xl font-extrabold uppercase leading-none"
              style={{ color: "#FFFFFF", animationDelay: ".25s" }}
            >
              {celebration.title}
            </h2>
            <div
              className="ach-up relative z-[1] mt-3 px-3 py-1 text-[11px] font-extrabold uppercase"
              style={{
                color: "#A89C95",
                border: "2px solid #4A433D",
                letterSpacing: "0.1em",
                animationDelay: ".3s",
              }}
            >
              {CATEGORY_LABELS[celebration.category]}
            </div>
            <p
              className="ach-up relative z-[1] mt-4 max-w-[380px] text-[15px] font-medium leading-relaxed"
              style={{ color: "#A89C95", animationDelay: ".35s" }}
            >
              {celebration.description}
            </p>
            <div
              className="ach-up relative z-[1] mt-8 flex gap-3.5"
              style={{ animationDelay: ".42s" }}
            >
              <a
                href={`/share/achievement/${encodeURIComponent(username)}/${encodeURIComponent(celebration.id)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ach-btn inline-flex items-center gap-2 px-6 py-3 text-[13px] font-extrabold uppercase tracking-wide"
                style={{
                  color: "#FFFFFF",
                  backgroundColor: "var(--accent, #FF3A00)",
                  border: "2px solid #0F0F0F",
                  boxShadow: "4px 4px 0 #000",
                }}
              >
                <Share2 size={15} strokeWidth={2.4} />
                Share Badge
              </a>
              <button
                type="button"
                onClick={close}
                className="inline-flex items-center gap-2 px-6 py-3 text-[13px] font-extrabold uppercase tracking-wide"
                style={{
                  color: "#FFFFFF",
                  backgroundColor: "#1A1715",
                  border: "2px solid #4A433D",
                }}
              >
                <X size={15} strokeWidth={2.6} />
                Nice!
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
