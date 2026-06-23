"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Share2 } from "lucide-react";
import { BadgeMedallion } from "@/components/achievements/badge-medallion";
import { getBadgeArt } from "@/lib/achievements/badge-art";
import {
  CATEGORY_LABELS,
  type AchievementView,
} from "@/lib/achievements/definitions";

interface AchievementCelebrationProps {
  achievement: AchievementView;
  username: string;
  onClose: () => void;
  accent?: string;
}

const DEFAULT_ACCENT = "#FF3A00";

/**
 * Full-screen "Achievement unlocked" celebration — confetti burst, an
 * animated medallion, and a share action. Mounted only while a badge is
 * being celebrated (the parent renders it conditionally), so its lifecycle
 * effects run once per open. Honors `prefers-reduced-motion` by skipping the
 * confetti and all entrance animations.
 */
export function AchievementCelebration({
  achievement,
  username,
  onClose,
  accent = DEFAULT_ACCENT,
}: AchievementCelebrationProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [shared, setShared] = useState(false);
  // Lazy init runs on the client (this never renders during SSR — it only
  // mounts after a click), so matchMedia resolves correctly here.
  const [reduced] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  const art = getBadgeArt(achievement.id);
  const anim = (value: string) => (reduced ? undefined : value);

  // ── Confetti ──────────────────────────────────────────────────────
  useEffect(() => {
    if (reduced) return;
    const cv = canvasRef.current;
    if (!cv) return;

    const rect = cv.getBoundingClientRect();
    const W = (cv.width = rect.width);
    const H = (cv.height = rect.height);
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const colors = [accent, "#F0B400", "#10B981", "#0EA5E9", "#EC4899", "#FFFFFF"];
    const cx = W / 2;
    const cy = H * 0.42;
    const parts = Array.from({ length: 170 }, () => {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.5;
      const speed = 5 + Math.random() * 13;
      return {
        x: cx + (Math.random() - 0.5) * 60,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rot: Math.random() * 6.28,
        vr: (Math.random() - 0.5) * 0.4,
        w: 6 + Math.random() * 8,
        h: 9 + Math.random() * 10,
        color: colors[(Math.random() * colors.length) | 0],
        strip: Math.random() > 0.6,
      };
    });

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
      if (frame < 175 && alive > 0) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, W, H);
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [accent, reduced]);

  // ── Esc to close, body scroll lock, focus management ──────────────
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  const share = useCallback(async () => {
    const url = new URL(
      `/share/achievement/${encodeURIComponent(username)}/${encodeURIComponent(achievement.id)}`,
      window.location.origin,
    ).toString();
    const text = `I just earned the "${achievement.title}" achievement on VibeTalent`;
    if (navigator.share) {
      try {
        await navigator.share({ title: achievement.title, text, url });
      } catch {
        // User dismissed the share sheet or it failed — nothing to do.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setShared(true);
      setTimeout(() => setShared(false), 1800);
    } catch {
      // Clipboard unavailable — silently no-op.
    }
  }, [achievement.id, achievement.title, username]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cel-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(8,6,5,0.86)",
        backdropFilter: "blur(3px)",
        WebkitBackdropFilter: "blur(3px)",
        animation: anim("cel-scrim-fade 0.28s ease-out"),
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 3,
        }}
      />
      <div
        style={{
          position: "relative",
          zIndex: 2,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          padding: 40,
          maxWidth: 540,
        }}
      >
        {/* Spray + paint-splat decor */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: -10,
            left: "50%",
            transform: "translateX(-50%)",
            width: 340,
            height: 340,
            background: `radial-gradient(circle, ${hexToRgba(accent, 0.28)}, transparent 65%)`,
            animation: anim("cel-spray-in 0.6s ease-out both"),
            pointerEvents: "none",
          }}
        />
        <Splat color="#F0B400" rot="-16deg" size={120} top={30} left={60} blur={2} delay={0.05} anim={anim} />
        <Splat color="#10B981" rot="20deg" size={110} top={50} right={54} blur={2} delay={0.12} anim={anim} />
        <Splat color="#0EA5E9" rot="8deg" size={70} top={120} left={90} blur={1} delay={0.2} anim={anim} />

        <div
          style={{
            position: "relative",
            zIndex: 1,
            animation: anim("cel-pop-in 0.75s cubic-bezier(0.2,1.35,0.4,1) both"),
          }}
        >
          <BadgeMedallion
            paletteKey={art.palette}
            icon={art.icon}
            chipLabel={art.chipLabel}
            size={150}
            earned
            animate={!reduced}
          />
        </div>

        <div
          style={{
            position: "relative",
            zIndex: 1,
            marginTop: 30,
            fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: "0.3em",
            color: accent,
            animation: anim("cel-up-fade 0.5s 0.18s both"),
          }}
        >
          ACHIEVEMENT UNLOCKED
        </div>
        <h2
          id="cel-title"
          style={{
            position: "relative",
            zIndex: 1,
            margin: "10px 0 0",
            fontSize: 42,
            fontWeight: 700,
            lineHeight: 1,
            textTransform: "uppercase",
            color: "#fff",
            animation: anim("cel-up-fade 0.5s 0.25s both"),
          }}
        >
          {achievement.title}
        </h2>
        <div
          style={{
            position: "relative",
            zIndex: 1,
            marginTop: 12,
            padding: "4px 12px",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#A89C95",
            border: "2px solid #4A433D",
            animation: anim("cel-up-fade 0.5s 0.3s both"),
          }}
        >
          {CATEGORY_LABELS[achievement.category]}
        </div>
        <p
          style={{
            position: "relative",
            zIndex: 1,
            margin: "16px 0 0",
            fontSize: 15,
            fontWeight: 500,
            lineHeight: 1.5,
            color: "#A89C95",
            maxWidth: 380,
            animation: anim("cel-up-fade 0.5s 0.35s both"),
          }}
        >
          {achievement.description}
        </p>
        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            gap: 14,
            marginTop: 30,
            animation: anim("cel-up-fade 0.5s 0.42s both"),
          }}
        >
          <button
            type="button"
            onClick={share}
            className="btn-brutal"
            style={{
              padding: "13px 26px",
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "#fff",
              background: accent,
              border: "2px solid #0F0F0F",
              boxShadow: "4px 4px 0 #000",
            }}
          >
            <Share2 size={15} strokeWidth={2.4} />
            {shared ? "Link copied!" : "Share badge"}
          </button>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            style={{
              padding: "13px 26px",
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "#fff",
              background: "#1A1715",
              border: "2px solid #4A433D",
              cursor: "pointer",
            }}
          >
            Nice!
          </button>
        </div>
      </div>
    </div>
  );
}

function Splat({
  color,
  rot,
  size,
  top,
  left,
  right,
  blur,
  delay,
  anim,
}: {
  color: string;
  rot: string;
  size: number;
  top: number;
  left?: number;
  right?: number;
  blur: number;
  delay: number;
  anim: (v: string) => string | undefined;
}) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        top,
        left,
        right,
        width: size,
        height: size,
        ["--r" as string]: rot,
        background: `radial-gradient(circle, ${color}, transparent 62%)`,
        filter: `blur(${blur}px)`,
        transform: `rotate(${rot})`,
        animation: anim(`cel-splat-in 0.55s ${delay}s ease-out both`),
        pointerEvents: "none",
      }}
    />
  );
}

/** Expand a #RRGGBB hex into an rgba() string. Falls back to the hex on bad input. */
function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}
