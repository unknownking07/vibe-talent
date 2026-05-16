import Link from "next/link";
import Image from "next/image";

export interface ActiveBuilderRowProps {
  position: number;
  username: string;
  avatarUrl: string | null;
  currentRank: number;
  activeDays7d: number;
  commits7d: number;
  streak: number;
  vibeScore: number;
  isCrown?: boolean;
}

/**
 * A single row in the "Active builders this week" list.
 *
 * Mobile (<sm): renders as a 2-row stacked card — identity (position + avatar
 * + handle + meta) on top, the three stats (commits / streak / vibe score)
 * spread evenly underneath with a hairline divider. The previous design
 * forced 7 columns into a 335px viewport, which squeezed the handle column
 * to ~94px and wrapped "rank #X · Y/7 active" into 3 lines while the vibe
 * score clipped off the right edge.
 *
 * Tablet+ (sm+): keeps the original 6-column grid so the desktop look is
 * untouched. `sm:contents` makes the mobile wrappers transparent for layout
 * on larger screens so the children participate directly in the parent
 * grid — single source of truth for the markup, two responsive shapes.
 */
export function ActiveBuilderRow(p: ActiveBuilderRowProps) {
  return (
    <Link
      href={`/profile/${p.username}`}
      className={`block px-4 sm:px-5 py-3 sm:py-4 border-b border-[var(--border-subtle)] last:border-b-0 hover:bg-[var(--bg-surface-light)] transition-colors ${p.isCrown ? "bg-[#FFF7ED] dark:bg-[var(--bg-surface-light)] border-b-[var(--border-hard)]" : ""}`}
    >
      <div
        className="flex flex-col gap-3 sm:grid sm:items-center sm:gap-4"
        style={{ gridTemplateColumns: "44px 48px 1fr auto auto auto" }}
      >
        {/* Identity — flex on mobile, contents (transparent for grid) on sm+ */}
        <div className="flex items-center gap-3 min-w-0 sm:contents">
          <span className="font-mono text-[14px] sm:text-[15px] font-extrabold text-[var(--text-secondary)] shrink-0 w-7 sm:w-auto">
            {String(p.position).padStart(2, "0")}
          </span>

          {p.avatarUrl ? (
            <Image
              src={p.avatarUrl}
              alt={p.username}
              width={48}
              height={48}
              className="rounded-full border-2 border-[var(--border-hard)] w-10 h-10 sm:w-12 sm:h-12 shrink-0"
            />
          ) : (
            <div
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-[var(--border-hard)] flex items-center justify-center text-white font-extrabold text-[15px] sm:text-[17px] shrink-0"
              style={{ background: "linear-gradient(135deg, var(--accent), #FFA07A)" }}
            >
              {p.username[0]?.toUpperCase()}
            </div>
          )}

          <div className="min-w-0 flex-1 sm:flex-none">
            <div className="font-bold text-[15px] sm:text-[16px] text-[var(--foreground)] leading-tight truncate">@{p.username}</div>
            <div className="text-[12px] sm:text-[13px] font-mono text-[var(--text-tertiary)] mt-0.5 sm:mt-1 truncate">
              rank #{p.currentRank} · {p.activeDays7d}/7 active
            </div>
          </div>
        </div>

        {/* Stats — full-width flex row on mobile (under the identity block),
            contents on sm+ so each stat lands in its own grid column. The
            indent (pl-[52px]) keeps the stats visually aligned under the
            handle column on mobile rather than swimming back to the rail. */}
        <div className="flex justify-between items-start gap-2 pt-2 pl-[52px] sm:pl-0 border-t border-[var(--border-subtle)] sm:border-t-0 sm:pt-0 sm:contents">
          <div className="text-left sm:text-right sm:min-w-[70px]">
            <div className="font-mono font-black text-[18px] sm:text-[22px] leading-none text-[var(--foreground)]">
              {p.commits7d}
            </div>
            <div className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-widest text-[var(--text-secondary)] mt-1">
              COMMITS
            </div>
          </div>

          <div className="text-left sm:text-right sm:min-w-[70px]">
            <div className="font-mono font-black text-[18px] sm:text-[22px] leading-none text-[var(--foreground)] tracking-tight">
              {p.streak}
            </div>
            <div className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-widest text-[var(--text-secondary)] mt-1">
              DAY STREAK
            </div>
          </div>

          <div className="text-left sm:text-right sm:min-w-[70px]">
            <div className="font-mono font-black text-[18px] sm:text-[22px] leading-none text-[var(--accent)]">
              {p.vibeScore}
            </div>
            <div className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-widest text-[var(--text-secondary)] mt-1">
              VIBE SCORE
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
