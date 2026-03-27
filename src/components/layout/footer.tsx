import Link from "next/link";
import { Flame } from "lucide-react";

export function Footer() {
  return (
    <footer
      style={{
        backgroundColor: "#FFFFFF",
        borderTop: "2px solid #0F0F0F",
      }}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-8">
          <div className="sm:col-span-2">
            <div className="flex items-center gap-2.5 mb-3">
              <div
                className="flex h-9 w-9 items-center justify-center"
                style={{
                  backgroundColor: "var(--accent)",
                  border: "2px solid #0F0F0F",
                  boxShadow: "3px 3px 0 #0F0F0F",
                }}
              >
                <Flame size={18} className="text-white" />
              </div>
              <span className="text-lg font-extrabold uppercase tracking-tight text-[#0F0F0F]">
                VibeTalent
              </span>
            </div>
            <p className="text-sm text-[#52525B] max-w-md font-medium">
              The marketplace for vibe coders who actually ship. Build your reputation through consistency and proof of work.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-extrabold uppercase tracking-wide text-[#0F0F0F] mb-3">Platform</h4>
            <div className="flex flex-col gap-2">
              <Link href="/explore" className="text-sm font-semibold text-[#52525B] hover:text-[var(--accent)] transition-colors">Explore</Link>
              <Link href="/leaderboard" className="text-sm font-semibold text-[#52525B] hover:text-[var(--accent)] transition-colors">Leaderboard</Link>
              <Link href="/dashboard" className="text-sm font-semibold text-[#52525B] hover:text-[var(--accent)] transition-colors">Dashboard</Link>
              <a href="https://vibe-talent.gitbook.io/untitled" target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-[#52525B] hover:text-[var(--accent)] transition-colors">Docs</a>
            </div>
          </div>
        </div>
        <div
          className="mt-10 pt-6 text-center text-xs font-bold uppercase tracking-wider text-[#71717A]"
          style={{ borderTop: "2px solid #0F0F0F" }}
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
