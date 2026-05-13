import Link from "next/link";
import Image from "next/image";

export interface ActiveBuilderRowProps {
  position: number;
  username: string;
  avatarUrl: string | null;
  currentRank: number;
  activeDays7d: number;
  streak: number;
  vibeScore: number;
  isCrown?: boolean;
}

export function ActiveBuilderRow(p: ActiveBuilderRowProps) {
  return (
    <Link
      href={`/profile/${p.username}`}
      className={`grid items-center gap-5 px-5 py-4 border-b border-[var(--border-subtle)] last:border-b-0 hover:bg-[var(--bg-surface-light)] transition-colors ${p.isCrown ? "bg-[#FFF7ED] dark:bg-[var(--bg-surface-light)] border-b-[var(--border-hard)]" : ""}`}
      style={{ gridTemplateColumns: "44px 48px 1fr auto auto auto" }}
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
          rank #{p.currentRank} · {p.activeDays7d}/7 active
        </div>
      </div>

      <div className="text-right min-w-[80px]">
        <div className="font-mono font-black text-[22px] leading-none text-[var(--foreground)] tracking-tight">
          {p.streak}
        </div>
        <div className="text-[11px] font-extrabold uppercase tracking-widest text-[var(--text-secondary)] mt-1">
          {p.streak === 1 ? "DAY STREAK" : "DAY STREAK"}
        </div>
      </div>

      <div className="text-right min-w-[60px]">
        <div className="font-mono font-black text-[22px] leading-none text-[var(--foreground)]">
          {p.activeDays7d}
        </div>
        <div className="text-[11px] font-extrabold uppercase tracking-widest text-[var(--text-secondary)] mt-1">
          /7 ACTIVE
        </div>
      </div>

      <div className="text-right min-w-[70px]">
        <div className="font-mono font-black text-[22px] leading-none text-[var(--accent)]">{p.vibeScore}</div>
        <div className="text-[11px] font-extrabold uppercase tracking-widest text-[var(--text-secondary)] mt-1">VIBE</div>
      </div>
    </Link>
  );
}
