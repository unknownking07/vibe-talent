import { Check, Lock } from "lucide-react";
import type { AchievementState } from "@/lib/achievements/definitions";
import { getBadgeArt } from "@/lib/achievements/badge-art";
import { BadgeMedallion } from "@/components/achievements/badge-medallion";
import { AchievementShareMenu } from "@/components/achievements/achievement-share-menu";

interface AchievementCardProps {
  achievement: AchievementState;
  username: string;
}

export function AchievementCard({ achievement, username }: AchievementCardProps) {
  const { id, title, description, threshold, current, earned, percent, unit } = achievement;
  const showProgressNumbers = threshold > 1;
  const art = getBadgeArt(id);
  // Defensive clamp — `percent` is already clamped at compute time, but
  // belt-and-suspenders before piping it into a CSS width.
  const safePercent = Number.isFinite(percent)
    ? Math.max(0, Math.min(100, percent))
    : 0;

  return (
    <div
      className="relative flex flex-col gap-3 p-5"
      style={{
        backgroundColor: earned
          ? "var(--bg-surface)"
          : "var(--bg-surface-light, var(--bg-surface))",
        border: "2px solid var(--border-hard)",
        boxShadow: earned ? "var(--shadow-brutal-sm)" : "none",
        opacity: earned ? 1 : 0.92,
      }}
    >
      <div className="flex items-start gap-4">
        <BadgeMedallion
          paletteKey={art.palette}
          icon={art.icon}
          chipLabel={art.chipLabel}
          size={72}
          earned={earned}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h3
                className="text-sm font-extrabold uppercase tracking-wide"
                style={{ color: "var(--foreground)" }}
              >
                {title}
              </h3>
              {earned ? (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-extrabold uppercase"
                  style={{
                    backgroundColor: "var(--status-success-bg, #DCFCE7)",
                    color: "var(--status-success-text, #166534)",
                    border: "1px solid var(--border-hard)",
                  }}
                >
                  <Check size={10} strokeWidth={3} />
                  Earned
                </span>
              ) : (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-extrabold uppercase"
                  style={{
                    backgroundColor: "var(--bg-base)",
                    color: "var(--text-muted)",
                    border: "1px solid var(--border-hard)",
                  }}
                >
                  <Lock size={10} strokeWidth={3} />
                  Locked
                </span>
              )}
            </div>
            {earned ? (
              <AchievementShareMenu
                username={username}
                achievementId={id}
                title={title}
              />
            ) : null}
          </div>
          <p
            className="text-xs font-medium leading-snug"
            style={{ color: "var(--text-secondary)" }}
          >
            {description}
          </p>
        </div>
      </div>

      {showProgressNumbers && (
        <div className="flex flex-col gap-1.5">
          <div
            className="h-2 w-full overflow-hidden"
            style={{
              backgroundColor: "var(--bg-base)",
              border: "1px solid var(--border-hard)",
            }}
            role="progressbar"
            aria-label={`${title} progress`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={safePercent}
            aria-valuetext={`${current.toLocaleString()} of ${threshold.toLocaleString()} ${unit}`}
          >
            <div
              className="h-full"
              style={{
                width: `${safePercent}%`,
                backgroundColor: earned
                  ? "var(--badge-gold, #EAB308)"
                  : "var(--text-muted)",
                transition: "width 200ms ease-out",
              }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wide">
            <span style={{ color: "var(--text-secondary)" }}>
              {current.toLocaleString()} / {threshold.toLocaleString()} {unit}
            </span>
            <span style={{ color: earned ? "var(--foreground)" : "var(--text-muted)" }}>
              {safePercent}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
