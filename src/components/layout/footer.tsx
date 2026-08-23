import Link from "next/link";
import Image from "next/image";
import { VIBE_MINT, VIBE_BUY_URL } from "@/lib/vibe-config";

export function Footer() {
  return (
    <footer
      style={{
        backgroundColor: "var(--bg-surface)",
        borderTop: "1px solid var(--border-hard)",
      }}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-8">
          <div className="sm:col-span-3 lg:col-span-2">
            <div className="flex items-center gap-2.5 mb-3">
              <Image
                src="/logo.png"
                alt="VibeTalent"
                width={36}
                height={36}
                className="object-contain"
              />
              {/* Uppercased in CSS rather than in the text, so the accessible
                  name stays "Vibe Talent" and screen readers do not spell it
                  out a letter at a time. */}
              <span
                className="text-lg font-bold uppercase tracking-tight"
                style={{ color: "var(--foreground)" }}
              >
                Vibe Talent
              </span>
            </div>
            <p
              className="text-sm max-w-md font-medium"
              style={{ color: "var(--text-muted)" }}
            >
              The marketplace for vibe coders who actually ship. Build your
              reputation through consistency and proof of work.
            </p>
          </div>
          <div>
            <h4
              className="text-sm font-semibold mb-3"
              style={{ color: "var(--foreground)" }}
            >
              Platform
            </h4>
            <div className="flex flex-col gap-2">
              <Link
                href="/explore"
                className="text-sm font-semibold hover:text-[var(--accent)] transition-colors"
                style={{ color: "var(--text-muted)" }}
              >
                Explore
              </Link>
              <Link
                href="/feed"
                className="text-sm font-semibold hover:text-[var(--accent)] transition-colors"
                style={{ color: "var(--text-muted)" }}
              >
                Feed
              </Link>
              <Link
                href="/leaderboard"
                className="text-sm font-semibold hover:text-[var(--accent)] transition-colors"
                style={{ color: "var(--text-muted)" }}
              >
                Leaderboard
              </Link>
              <Link
                href="/dashboard"
                className="text-sm font-semibold hover:text-[var(--accent)] transition-colors"
                style={{ color: "var(--text-muted)" }}
              >
                Dashboard
              </Link>
              <Link
                href="/roadmap"
                className="text-sm font-semibold hover:text-[var(--accent)] transition-colors"
                style={{ color: "var(--text-muted)" }}
              >
                Roadmap
              </Link>
              <Link
                href="/token"
                className="text-sm font-semibold hover:text-[var(--accent)] transition-colors"
                style={{ color: "var(--text-muted)" }}
              >
                $VIBE Token
              </Link>
              <Link
                href="/bags"
                className="text-sm font-semibold hover:text-[var(--accent)] transition-colors"
                style={{ color: "var(--text-muted)" }}
              >
                Bags Builders
              </Link>
              <a
                href="https://vibe-talent.gitbook.io/untitled"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Docs (opens in new tab)"
                className="text-sm font-semibold hover:text-[var(--accent)] transition-colors"
                style={{ color: "var(--text-muted)" }}
              >
                Docs
              </a>
            </div>
          </div>
          {/*
            The /vs/* comparison pages target the highest-intent queries we
            have ("hire vibe coders", "upwork alternative"), but they were
            orphaned: the only internal link to any of them was from /vs, and
            /vs itself was linked from nowhere. Google discovered them via the
            sitemap and then never crawled them ("Discovered - currently not
            indexed"). A site-wide footer link is the cheapest durable fix.
          */}
          <div>
            <h4
              className="text-sm font-semibold mb-3"
              style={{ color: "var(--foreground)" }}
            >
              Compare
            </h4>
            <div className="flex flex-col gap-2">
              <Link
                href="/hire-vibe-coders"
                className="text-sm font-semibold hover:text-[var(--accent)] transition-colors"
                style={{ color: "var(--text-muted)" }}
              >
                How to hire
              </Link>
              <Link
                href="/vs/upwork"
                className="text-sm font-semibold hover:text-[var(--accent)] transition-colors"
                style={{ color: "var(--text-muted)" }}
              >
                vs Upwork
              </Link>
              <Link
                href="/vs/fiverr"
                className="text-sm font-semibold hover:text-[var(--accent)] transition-colors"
                style={{ color: "var(--text-muted)" }}
              >
                vs Fiverr
              </Link>
              <Link
                href="/vs/toptal"
                className="text-sm font-semibold hover:text-[var(--accent)] transition-colors"
                style={{ color: "var(--text-muted)" }}
              >
                vs Toptal
              </Link>
              <Link
                href="/vs/freelancer"
                className="text-sm font-semibold hover:text-[var(--accent)] transition-colors"
                style={{ color: "var(--text-muted)" }}
              >
                vs Freelancer
              </Link>
              <Link
                href="/glossary"
                className="text-sm font-semibold hover:text-[var(--accent)] transition-colors"
                style={{ color: "var(--text-muted)" }}
              >
                Glossary
              </Link>
            </div>
          </div>
          <div>
            <h4
              className="text-sm font-semibold mb-3"
              style={{ color: "var(--foreground)" }}
            >
              Community
            </h4>
            <div className="flex flex-col gap-2">
              <a
                href="https://t.me/vibetalentwork"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Telegram community (opens in new tab)"
                className="text-sm font-semibold hover:text-[var(--accent)] transition-colors"
                style={{ color: "var(--text-muted)" }}
              >
                Telegram
              </a>
            </div>
          </div>
          <div>
            <h4
              className="text-sm font-semibold mb-3"
              style={{ color: "var(--foreground)" }}
            >
              Legal
            </h4>
            <div className="flex flex-col gap-2">
              <Link
                href="/about"
                className="text-sm font-semibold hover:text-[var(--accent)] transition-colors"
                style={{ color: "var(--text-muted)" }}
              >
                About
              </Link>
              <Link
                href="/privacy"
                className="text-sm font-semibold hover:text-[var(--accent)] transition-colors"
                style={{ color: "var(--text-muted)" }}
              >
                Privacy Policy
              </Link>
              <Link
                href="/terms"
                className="text-sm font-semibold hover:text-[var(--accent)] transition-colors"
                style={{ color: "var(--text-muted)" }}
              >
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
        <div
          className="mt-10 pt-6 text-center text-xs font-medium"
          style={{
            borderTop: "1px solid var(--border-subtle)",
            color: "var(--text-muted)",
          }}
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
          <span className="block mt-2">
            $VIBE on Solana:{" "}
            <code
              className="font-mono break-all"
              style={{ color: "var(--text-secondary)" }}
            >
              {VIBE_MINT}
            </code>
            {" · "}
            <a
              href={VIBE_BUY_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Buy $VIBE on Bags (opens in new tab)"
              className="text-[var(--accent)] hover:underline"
            >
              Buy on Bags
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}
