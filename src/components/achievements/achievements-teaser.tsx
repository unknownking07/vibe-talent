import Link from "next/link";
import { ArrowRight, Trophy } from "lucide-react";
import { getBadgeArt } from "@/lib/achievements/badge-art";
import { BadgeMedallion } from "@/components/achievements/badge-medallion";
import {
  CATEGORY_ORDER,
  type AchievementState,
} from "@/lib/achievements/definitions";

interface AchievementsTeaserProps {
  achievements: AchievementState[];
  username: string;
}

export function AchievementsTeaser({
  achievements,
  username,
}: AchievementsTeaserProps) {
  const total = achievements.length;
  const earnedCount = achievements.filter((a) => a.earned).length;
  const percent = total > 0 ? Math.round((earnedCount / total) * 100) : 0;

  // Sort by category (matches the full page grouping) so the teaser
  // reads as a curated collection rather than a random pile.
  const ordered = CATEGORY_ORDER.flatMap((cat) =>
    achievements.filter((a) => a.category === cat),
  );

  // "Next up" = the locked badge closest to unlocking. Drops badges
  // at 0% so we don't dangle distant goals — only show real momentum.
  const nextUp = achievements
    .filter((a) => !a.earned && a.percent > 0)
    .sort((a, b) => b.percent - a.percent)[0];

  return (
    <section
      className="overflow-hidden"
      style={{
        backgroundColor: "var(--bg-surface)",
        border: "2px solid var(--border-hard)",
        boxShadow: "var(--shadow-brutal)",
      }}
    >
      {/* Header */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 px-6 py-4"
        style={{ borderBottom: "2px solid var(--border-hard)" }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-7 w-7 items-center justify-center"
            style={{
              backgroundColor: "var(--accent, #FF3A00)",
              border: "2px solid var(--border-hard)",
            }}
          >
            <Trophy size={14} strokeWidth={3} color="#fff" />
          </div>
          <h3
            className="text-base font-extrabold uppercase tracking-wide"
            style={{ color: "var(--foreground)" }}
          >
            Achievements
          </h3>
        </div>
        <Link
          href={`/profile/${username}/achievements`}
          className="inline-flex items-center gap-1.5 btn-brutal btn-brutal-dark text-xs py-1.5 px-4"
        >
          View all
          <ArrowRight size={14} strokeWidth={3} />
        </Link>
      </div>

      {earnedCount === 0 && !nextUp ? (
        <EmptyState />
      ) : (
        <>
          <div className="flex flex-col gap-6 px-6 py-6 sm:flex-row sm:items-stretch sm:gap-8">
            <ProgressRing
              earnedCount={earnedCount}
              total={total}
              percent={percent}
            />
            <div className="flex-1">
              <BadgeShelf achievements={ordered} username={username} />
            </div>
          </div>

          {nextUp ? <NextUpBanner achievement={nextUp} /> : null}
        </>
      )}
    </section>
  );
}

// ─── Progress ring ────────────────────────────────────────────────

interface ProgressRingProps {
  earnedCount: number;
  total: number;
  percent: number;
}

function ProgressRing({ earnedCount, total, percent }: ProgressRingProps) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (percent / 100) * circumference;

  return (
    <div
      className="flex shrink-0 flex-col items-center justify-center gap-2 px-4 py-4 sm:w-[160px]"
      style={{
        backgroundColor: "var(--bg-base)",
        border: "2px solid var(--border-hard)",
      }}
    >
      <div className="relative flex items-center justify-center">
        <svg
          width={128}
          height={128}
          viewBox="0 0 128 128"
          style={{ transform: "rotate(-90deg)" }}
        >
          {/* Track */}
          <circle
            cx="64"
            cy="64"
            r={radius}
            fill="none"
            stroke="var(--bg-surface-light, #2a2a2a)"
            strokeWidth="10"
          />
          {/* Progress */}
          <circle
            cx="64"
            cy="64"
            r={radius}
            fill="none"
            stroke="var(--accent, #FF3A00)"
            strokeWidth="10"
            strokeLinecap="butt"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
          />
        </svg>
        <div className="absolute flex flex-col items-center leading-none">
          <span
            className="text-3xl font-extrabold tabular-nums"
            style={{ color: "var(--foreground)" }}
          >
            {earnedCount}
          </span>
          <span
            className="mt-0.5 text-[10px] font-extrabold uppercase tracking-widest"
            style={{ color: "var(--text-muted)" }}
          >
            of {total}
          </span>
        </div>
      </div>
      <div
        className="text-[10px] font-extrabold uppercase tracking-widest"
        style={{ color: "var(--text-secondary)" }}
      >
        Unlocked
      </div>
    </div>
  );
}

// ─── Badge shelf (all 20 slots) ───────────────────────────────────

interface BadgeShelfProps {
  achievements: AchievementState[];
  username: string;
}

function BadgeShelf({ achievements, username }: BadgeShelfProps) {
  return (
    <Link
      href={`/profile/${username}/achievements`}
      className="block"
      aria-label="View all achievements"
    >
      <div
        className="grid grid-cols-[repeat(auto-fill,minmax(54px,1fr))] gap-x-3 gap-y-4 sm:gap-x-4"
        style={{ rowGap: 22 }}
      >
        {achievements.map((a) => {
          const art = getBadgeArt(a.id);
          return (
            <div
              key={a.id}
              className="flex flex-col items-center"
              title={
                a.earned
                  ? a.title
                  : `${a.title} — ${a.current}/${a.threshold} ${a.unit}`
              }
            >
              <BadgeMedallion
                paletteKey={art.palette}
                icon={art.icon}
                chipLabel={art.chipLabel}
                size={48}
                earned={a.earned}
              />
            </div>
          );
        })}
      </div>
    </Link>
  );
}

// ─── Next up banner ───────────────────────────────────────────────

interface NextUpBannerProps {
  achievement: AchievementState;
}

function NextUpBanner({ achievement }: NextUpBannerProps) {
  const art = getBadgeArt(achievement.id);
  const remaining = achievement.threshold - achievement.current;

  return (
    <div
      className="flex flex-wrap items-center gap-4 px-6 py-4"
      style={{
        borderTop: "2px dashed var(--border-hard)",
        backgroundColor: "var(--bg-base)",
      }}
    >
      <div className="flex shrink-0 items-center gap-3">
        <BadgeMedallion
          paletteKey={art.palette}
          icon={art.icon}
          chipLabel={art.chipLabel}
          size={44}
          earned={false}
        />
        <div className="flex flex-col">
          <span
            className="text-[9px] font-extrabold uppercase tracking-widest"
            style={{ color: "var(--text-muted)" }}
          >
            Next up
          </span>
          <span
            className="text-sm font-extrabold uppercase tracking-wide"
            style={{ color: "var(--foreground)" }}
          >
            {achievement.title}
          </span>
        </div>
      </div>
      <div className="flex min-w-[180px] flex-1 flex-col gap-1.5">
        <div
          className="h-2 w-full overflow-hidden"
          style={{
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border-hard)",
          }}
        >
          <div
            className="h-full"
            style={{
              width: `${achievement.percent}%`,
              backgroundColor: "var(--accent, #FF3A00)",
            }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wide">
          <span style={{ color: "var(--text-secondary)" }}>
            {achievement.current.toLocaleString()} / {achievement.threshold.toLocaleString()}{" "}
            {achievement.unit}
          </span>
          <span style={{ color: "var(--foreground)" }}>
            {remaining.toLocaleString()} to go
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────

function EmptyState() {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center"
    >
      <Trophy
        size={28}
        strokeWidth={2.5}
        style={{ color: "var(--text-muted)" }}
      />
      <p
        className="text-xs font-extrabold uppercase tracking-wide"
        style={{ color: "var(--text-muted)" }}
      >
        No achievements yet — start a streak to earn your first badge
      </p>
    </div>
  );
}
