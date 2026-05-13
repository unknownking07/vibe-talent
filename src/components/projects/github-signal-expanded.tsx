import { GithubSparkline } from "./github-sparkline";

interface Props {
  commits7d: number | null;
  values7d: number[] | null;
  lastCommitHash: string | null;
  lastCommitMessage: string | null;
  lastCommitAgo: string | null;
  githubUrl: string | null;
}

export function GithubSignalExpanded({ commits7d, values7d, lastCommitHash, lastCommitMessage, lastCommitAgo, githubUrl }: Props) {
  if (!githubUrl) return null;
  const showMessage = lastCommitMessage && lastCommitMessage.trim().length >= 5;

  return (
    <div className="mt-3 bg-[var(--bg-inverted)] text-[var(--text-on-inverted)] rounded font-mono overflow-hidden">
      <div className="grid items-center gap-3 px-3 py-2.5 border-b border-[#2a2a2a]" style={{ gridTemplateColumns: "1fr auto" }}>
        <div>
          <div className="text-[11px] text-[var(--text-muted)] tracking-wider font-extrabold">COMMITS / 7d</div>
          <div className="text-[16px] font-extrabold text-[var(--accent)] leading-none mt-1">{commits7d ?? 0}</div>
        </div>
        <GithubSparkline values={values7d ?? []} />
      </div>
      {showMessage && lastCommitHash && (
        <div className="px-3 py-2 flex gap-2 items-center text-[12px]">
          <span className="bg-[var(--accent)] text-[var(--bg-inverted)] px-1.5 font-extrabold rounded-sm">{lastCommitHash.slice(0, 6)}</span>
          <span className="flex-1 truncate">{lastCommitMessage}</span>
          {lastCommitAgo && <span className="text-[10px] text-[var(--text-muted)]">{lastCommitAgo}</span>}
        </div>
      )}
    </div>
  );
}
