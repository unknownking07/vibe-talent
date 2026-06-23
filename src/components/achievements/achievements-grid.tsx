import { memo } from "react";
import { AchievementCard } from "@/components/achievements/achievement-card";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type AchievementView,
} from "@/lib/achievements/definitions";

interface AchievementsGridProps {
  achievements: AchievementView[];
  username: string;
  /** Called with an earned achievement when its badge is tapped, to replay the celebration. */
  onCelebrate: (achievement: AchievementView) => void;
}

function AchievementsGridImpl({
  achievements,
  username,
  onCelebrate,
}: AchievementsGridProps) {
  const grouped = CATEGORY_ORDER.map((cat) => ({
    cat,
    items: achievements.filter((a) => a.category === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-col gap-8">
      {grouped.map(({ cat, items }) => {
        const earnedInCat = items.filter((i) => i.earned).length;
        return (
          <section key={cat} className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
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
            <div
              className="grid gap-4"
              style={{
                gridTemplateColumns:
                  "repeat(auto-fill, minmax(min(100%, 340px), 1fr))",
              }}
            >
              {items.map((a) => (
                <AchievementCard
                  key={a.id}
                  achievement={a}
                  username={username}
                  onCelebrate={
                    a.earned ? () => onCelebrate(a) : undefined
                  }
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/**
 * Memoized so the header count-up (which re-renders the parent view ~60×/sec
 * during the intro animation) doesn't re-render all 20 medallion SVGs each
 * frame. Props are stable: `achievements` is the server-passed array and
 * `onCelebrate` is a stable setState updater.
 */
export const AchievementsGrid = memo(AchievementsGridImpl);
