import { ActiveBuilderRow, type ActiveBuilderRowProps } from "./active-builder-row";

interface Props {
  rows: ActiveBuilderRowProps[] | null;
  error: string | null;
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
    return <div className="text-[13px] text-[var(--text-muted)] p-4">Loading…</div>;
  }
  if (rows.length === 0) {
    return <div className="text-[13px] text-[var(--text-muted)] p-4">No active builders in the last 7 days yet.</div>;
  }

  return (
    <div className="bg-[var(--bg-surface)] border-2 border-[var(--border-hard)] rounded overflow-hidden" style={{ boxShadow: "var(--shadow-brutal)" }}>
      <header className="bg-[var(--bg-inverted)] text-[var(--text-on-inverted)] px-5 py-4 flex justify-between items-center">
        <h3 className="text-[15px] font-extrabold tracking-wider">ACTIVE BUILDERS</h3>
        <span className="bg-[var(--accent)] text-white px-3 py-1 text-[12px] font-extrabold rounded-sm">LAST 7 DAYS</span>
      </header>
      <div>
        {rows.map((r) => <ActiveBuilderRow key={r.username} {...r} />)}
      </div>
    </div>
  );
}
