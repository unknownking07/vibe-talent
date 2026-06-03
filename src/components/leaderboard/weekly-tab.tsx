import type { ReactNode } from "react";
import { ActiveBuilderRow, type ActiveBuilderRowProps } from "./active-builder-row";

interface Props {
  rows: ActiveBuilderRowProps[] | null;
  error: string | null;
}

/**
 * Container + header shared by the loading and loaded states, so the skeleton
 * reserves the exact frame the real list drops into — no layout shift when the
 * weekly fetch resolves. The "ACTIVE BUILDERS / LAST 7 DAYS" header is static
 * chrome, so it renders immediately rather than shimmering.
 */
function WeeklyShell({ children }: { children: ReactNode }) {
  return (
    <div className="bg-[var(--bg-surface)] border-2 border-[var(--border-hard)] rounded overflow-hidden" style={{ boxShadow: "var(--shadow-brutal)" }}>
      <header className="bg-[var(--bg-inverted)] text-[var(--text-on-inverted)] px-5 py-4 flex justify-between items-center">
        <h3 className="text-[15px] font-extrabold tracking-wider">ACTIVE BUILDERS</h3>
        <span className="bg-[var(--accent)] text-white px-3 py-1 text-[12px] font-extrabold rounded-sm">LAST 7 DAYS</span>
      </header>
      <div>{children}</div>
    </div>
  );
}

/**
 * One placeholder row mirroring ActiveBuilderRow's layout — position chip,
 * avatar, handle + meta, and the three stat columns — so the shimmer lines up
 * with the real rows on both the mobile stacked shape and the sm+ grid.
 */
function SkeletonRow() {
  return (
    <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-[var(--border-subtle)] last:border-b-0">
      <div
        className="flex flex-col gap-3 sm:grid sm:items-center sm:gap-4"
        style={{ gridTemplateColumns: "44px 48px 1fr auto auto auto" }}
      >
        {/* Identity — flex on mobile, contents (transparent for grid) on sm+ */}
        <div className="flex items-center gap-3 min-w-0 sm:contents">
          <div className="skeleton h-4 w-6 sm:w-7 shrink-0" />
          <div className="skeleton w-10 h-10 sm:w-12 sm:h-12 rounded-full shrink-0" />
          <div className="min-w-0 flex-1 sm:flex-none">
            <div className="skeleton h-4 w-28 mb-1.5" />
            <div className="skeleton h-3 w-20" />
          </div>
        </div>

        {/* Stats — three columns, right-aligned on sm+ to match the real numbers */}
        <div className="flex justify-between items-start gap-2 pt-2 pl-[52px] sm:pl-0 border-t border-[var(--border-subtle)] sm:border-t-0 sm:pt-0 sm:contents">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-col items-start sm:items-end sm:min-w-[70px]">
              <div className="skeleton h-5 sm:h-6 w-9" />
              <div className="skeleton h-3 w-14 mt-1.5" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function WeeklyTab({ rows, error }: Props) {
  if (error) {
    return (
      <div className="text-[13px] text-[var(--status-error-text)] bg-[var(--status-error-bg)] border border-[var(--status-error-border)] p-4 rounded">
        Couldn&apos;t load active builders ({error}).
      </div>
    );
  }
  if (rows == null) {
    return (
      <WeeklyShell>
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </WeeklyShell>
    );
  }
  if (rows.length === 0) {
    return <div className="text-[13px] text-[var(--text-muted)] p-4">No active builders in the last 7 days yet.</div>;
  }

  return (
    <WeeklyShell>
      {rows.map((r) => <ActiveBuilderRow key={r.username} {...r} />)}
    </WeeklyShell>
  );
}
