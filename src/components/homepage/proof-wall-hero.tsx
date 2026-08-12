import Link from "next/link";
import type { ProofWallData } from "@/lib/supabase/server-queries";

/**
 * The homepage hero, from the owner's design: a wall of real builder-days.
 *
 * Every square is one (builder, day) pair read from streak_logs — the last 70
 * days for the 8 most-active builders, shaded by commit count on the same
 * `--hm-*` scale as the profile heatmaps. Nothing here animates and nothing is
 * mocked; hovering a square names the builder, the day, and the commits
 * (native title tooltip, no JS).
 *
 * The headline is deliberately sentence case (`normal-case` beats the global
 * uppercase heading rule): it's a sentence being said, not a page title.
 */

/** Same tier thresholds as the profile heatmap, tuned for commit counts. */
function shadeFor(commits: number | undefined): string {
  if (!commits) return "var(--hm-0)";
  if (commits >= 7) return "var(--hm-4)";
  if (commits >= 4) return "var(--hm-3)";
  if (commits >= 2) return "var(--hm-2)";
  return "var(--hm-1)";
}

function prettyDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function ProofWallHero({ data }: { data: ProofWallData }) {
  const { days, rows, totalBuilderDays, longestStreak, buildersTracked } = data;

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 pt-12 sm:pt-16 pb-14">
      {/* Headline + explainer (the explainer describes the wall below it) */}
      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,340px)] lg:items-end">
        <h1 className="normal-case text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.05] text-[var(--foreground)]">
          The resume is dead.
          <br />
          <span className="text-[var(--accent)]">the proof of work isn&apos;t</span>
        </h1>
        <p className="text-sm sm:text-base text-[var(--text-secondary)] font-medium leading-relaxed lg:pb-2">
          Every square below is a day a builder shipped, read straight from GitHub. Hover any square
          for the builder, the day, and the commits.
        </p>
      </div>

      {/* The wall always spans the full column: one 1fr grid column per day,
          square cells. Sizing by fraction rather than fixed pixels means it
          fills edge to edge whatever the day count (the window shrinks when
          the backfill has less history) and scales down cleanly on mobile
          instead of clipping or scrolling. */}
      <div
        className="mt-10 py-6"
        style={{
          borderTop: "1px solid var(--border-subtle)",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <div className="flex justify-end gap-[3px] overflow-hidden" aria-hidden>
          {days.map((day) => (
            <div key={day} className="flex flex-col gap-[3px] shrink-0">
              {rows.map((row) => {
                const commits = row.cells[day];
                return (
                  <div
                    key={row.username}
                    className="w-[11px] h-[11px] sm:w-[14px] sm:h-[14px] rounded-[2px]"
                    style={{ backgroundColor: shadeFor(commits) }}
                    title={
                      commits
                        ? `@${row.username} · ${prettyDate(day)} · ${commits} ${commits === 1 ? "commit" : "commits"}`
                        : undefined
                    }
                  />
                );
              })}
            </div>
          ))}
        </div>
        <p className="sr-only">
          Activity wall: the last {days.length} days of verified GitHub shipping activity from the{" "}
          {rows.length} most active builders on VibeTalent.
        </p>
      </div>

      {/* Real totals + the one CTA */}
      <div className="mt-8 flex flex-wrap items-end justify-between gap-x-10 gap-y-8">
        <div className="flex flex-wrap gap-x-12 gap-y-6">
          {/* Wording matters here. Roughly half of streak_logs predates the
              platform (the github-sync backfill reads a year of contribution
              history), so "days verified" implied activity ON VibeTalent that
              these rows can't support. "GitHub-verified days" is what the
              number actually is: commit days read from GitHub rather than
              self-reported. Same reason the streak says "days, verified". */}
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              GitHub-verified days
            </div>
            <div className="mt-1 text-4xl sm:text-5xl font-extrabold tracking-tight text-[var(--foreground)]">
              {totalBuilderDays.toLocaleString("en-US")}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Longest streak
            </div>
            <div className="mt-1 text-4xl sm:text-5xl font-extrabold tracking-tight text-[var(--foreground)]">
              {longestStreak}
              <span className="ml-2 text-lg font-bold text-[var(--text-muted)]">days</span>
            </div>
          </div>
          {/* Was "Self-reported: None" (from the original mock). It reads as a
              rhetorical flourish rather than a statistic and nobody can tell
              what it counts, so it's a real number now. */}
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Builders tracked
            </div>
            <div className="mt-1 text-4xl sm:text-5xl font-extrabold tracking-tight text-[var(--accent)]">
              {buildersTracked}
            </div>
          </div>
        </div>
        <Link
          href="/auth/signup"
          className="inline-flex h-12 items-center justify-center rounded-xl px-6 text-sm font-semibold text-white transition-[background-color,transform] hover:bg-[var(--accent-hover)] active:scale-[0.98]"
          style={{ backgroundColor: "var(--accent)" }}
        >
          Start your streak
        </Link>
      </div>
    </section>
  );
}
