import Link from "next/link";
import Image from "next/image";

export interface LeaderboardRowProps {
  position: number;             // visual 1-indexed position
  username: string;
  avatarUrl: string | null;
  currentRank: number;
  previousRank: number | null;
  rankClimb: number | null;     // null = no prior data
  currentScore: number;
  scoreDelta: number | null;
  isCrown?: boolean;
}

export function LeaderboardRow(p: LeaderboardRowProps) {
  return (
    <Link
      href={`/profile/${p.username}`}
      className={`grid items-center gap-5 px-5 py-4 border-b border-[var(--border-subtle)] last:border-b-0 hover:bg-[var(--bg-surface-light)] transition-colors ${p.isCrown ? "bg-[#FFF7ED] dark:bg-[var(--bg-surface-light)] border-b-[var(--border-hard)]" : ""}`}
      style={{ gridTemplateColumns: "44px 48px 1fr auto auto" }}
    >
      <span className="font-mono text-[15px] font-extrabold text-[var(--text-secondary)]">
        {String(p.position).padStart(2, "0")}
      </span>

      {p.avatarUrl ? (
        <Image src={p.avatarUrl} alt={p.username} width={48} height={48} className="rounded-full border-2 border-[var(--border-hard)]" />
      ) : (
        <div
          className="w-12 h-12 rounded-full border-2 border-[var(--border-hard)] flex items-center justify-center text-white font-extrabold text-[17px]"
          style={{ background: "linear-gradient(135deg, var(--accent), #FFA07A)" }}
        >
          {p.username[0]?.toUpperCase()}
        </div>
      )}

      <div>
        <div className="font-bold text-[16px] text-[var(--foreground)] leading-tight">@{p.username}</div>
        <div className="text-[13px] font-mono text-[var(--text-tertiary)] mt-1">
          rank #{p.currentRank}
          {p.previousRank != null && ` · was #${p.previousRank}`}
        </div>
      </div>

      <div className="text-right min-w-[70px]">
        {p.rankClimb != null ? (
          <>
            <div className="font-mono font-black text-[22px] leading-none text-[var(--accent)] tracking-tight">
              {p.rankClimb > 0 ? `▲${p.rankClimb}` : p.rankClimb === 0 ? "·" : `▼${-p.rankClimb}`}
            </div>
            <div className="text-[11px] font-extrabold uppercase tracking-widest text-[var(--text-secondary)] mt-1">
              {Math.abs(p.rankClimb) === 1 ? "SPOT" : "SPOTS"}
            </div>
          </>
        ) : (
          <div className="text-[13px] font-mono text-[var(--text-muted)]">—</div>
        )}
      </div>

      <div className="text-right min-w-[70px]">
        <div className="font-mono font-extrabold text-[22px] leading-none text-[var(--foreground)]">{p.currentScore}</div>
        {p.scoreDelta != null && (
          <div className="text-[13px] font-extrabold font-mono text-[var(--accent)] mt-1">
            {p.scoreDelta >= 0 ? `+${p.scoreDelta}` : `${p.scoreDelta}`}
          </div>
        )}
      </div>
    </Link>
  );
}
