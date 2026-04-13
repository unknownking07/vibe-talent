import Link from "next/link";
import Image from "next/image";

export function Footer() {
  return (
    <footer
      style={{
        backgroundColor: "var(--bg-surface)",
        borderTop: "2px solid var(--border-hard)",
      }}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-8">
          <div className="sm:col-span-2">
            <div className="flex items-center gap-2.5 mb-3">
              <Image src="/logo.png" alt="VibeTalent" width={36} height={36} className="object-contain" />
              <span className="text-lg font-extrabold uppercase tracking-tight" style={{ color: "var(--foreground)" }}>
                VibeTalent
              </span>
            </div>
            <p className="text-sm max-w-md font-medium" style={{ color: "var(--text-muted)" }}>
              The marketplace for vibe coders who actually ship. Build your reputation through consistency and proof of work.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-extrabold uppercase tracking-wide mb-3" style={{ color: "var(--foreground)" }}>Platform</h4>
            <div className="flex flex-col gap-2">
              <Link href="/explore" className="text-sm font-semibold hover:text-[var(--accent)] transition-colors" style={{ color: "var(--text-muted)" }}>Explore</Link>
              <Link href="/feed" className="text-sm font-semibold hover:text-[var(--accent)] transition-colors" style={{ color: "var(--text-muted)" }}>Feed</Link>
              <Link href="/leaderboard" className="text-sm font-semibold hover:text-[var(--accent)] transition-colors" style={{ color: "var(--text-muted)" }}>Leaderboard</Link>
              <Link href="/dashboard" className="text-sm font-semibold hover:text-[var(--accent)] transition-colors" style={{ color: "var(--text-muted)" }}>Dashboard</Link>
              <a href="https://vibe-talent.gitbook.io/untitled" target="_blank" rel="noopener noreferrer" aria-label="Docs (opens in new tab)" className="text-sm font-semibold hover:text-[var(--accent)] transition-colors" style={{ color: "var(--text-muted)" }}>Docs</a>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-extrabold uppercase tracking-wide mb-3" style={{ color: "var(--foreground)" }}>Legal</h4>
            <div className="flex flex-col gap-2">
              <Link href="/about" className="text-sm font-semibold hover:text-[var(--accent)] transition-colors" style={{ color: "var(--text-muted)" }}>About</Link>
              <Link href="/privacy" className="text-sm font-semibold hover:text-[var(--accent)] transition-colors" style={{ color: "var(--text-muted)" }}>Privacy Policy</Link>
              <Link href="/terms" className="text-sm font-semibold hover:text-[var(--accent)] transition-colors" style={{ color: "var(--text-muted)" }}>Terms of Service</Link>
            </div>
          </div>
        </div>
        <div
          className="mt-10 pt-6 text-center text-xs font-bold uppercase tracking-wider"
          style={{ borderTop: "2px solid var(--border-hard)", color: "var(--text-muted)" }}
        >
          &copy; {new Date().getFullYear()} VibeTalent. Ship or miss.
          <span className="block mt-1">
            Builder:{" "}
            <a
              href="https://x.com/abhiontwt"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--accent)] hover:underline"
            >
              @abhiontwt
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}
