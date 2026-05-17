import { AchievementCard } from "@/components/achievements/achievement-card";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type AchievementState,
} from "@/lib/achievements/definitions";

interface AchievementsGridProps {
  achievements: AchievementState[];
  username: string;
}

export function AchievementsGrid({ achievements, username }: AchievementsGridProps) {
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((a) => (
                <AchievementCard key={a.id} achievement={a} username={username} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
