import { GithubSparkline } from "./github-sparkline";

interface Props {
  commits7d: number | null;
  values7d: number[] | null;
  lastCommitAgo: string | null;
  githubUrl: string | null;
}

export function GithubSignal({ commits7d, values7d, lastCommitAgo, githubUrl }: Props) {
  if (!githubUrl) {
    return (
      <div className="text-[11px] font-extrabold tracking-wider text-[var(--text-muted)] uppercase mt-2 px-3 py-2 bg-[var(--bg-surface-light)] rounded">
        no github linked
      </div>
    );
  }
  // No data yet — silently hide rather than showing misleading zeros.
  // (The github-sync cron doesn't store per-project commit aggregates as of v1;
  // when that lands, this guard becomes a no-op.)
  if (commits7d == null && values7d == null) {
    return null;
  }
  return (
    <div className="mt-3 px-3 py-2.5 bg-[var(--bg-inverted)] text-[var(--text-on-inverted)] rounded grid items-center gap-3 font-mono" style={{ gridTemplateColumns: "1fr auto auto" }}>
      <div>
        <div className="text-[11px] text-[var(--text-muted)] tracking-wider font-extrabold">COMMITS / 7d</div>
        <div className="text-[16px] font-extrabold text-[var(--accent)] leading-none mt-1">{commits7d ?? 0}</div>
      </div>
      <GithubSparkline values={values7d ?? []} />
      <div className="text-right text-[12px]">
        {lastCommitAgo ?? "—"}
        <div className="text-[10px] text-[var(--text-muted)]">last commit</div>
      </div>
    </div>
  );
}
