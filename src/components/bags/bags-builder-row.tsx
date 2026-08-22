import Link from "next/link";
import Image from "next/image";
import {
  ArrowUpRight,
  GithubLogo,
  Flame,
} from "@phosphor-icons/react/dist/ssr";

import { shortMint, type BagsBoardEntry } from "@/lib/bags-board";
import { hackathonProjectsFor } from "@/lib/hackathon-projects";

/**
 * One builder on the /bags board, in Bags' visual language: a dark rounded
 * card, hairline border, lime reserved for the one number that matters.
 *
 * Colours come from the .bags-theme scope rather than the site palette, because
 * this card sits on a canvas that stays dark in both site themes.
 *
 * The name opens this builder's launch detail rather than their VibeTalent
 * profile: someone scanning this board is asking what a person launched, and
 * the detail page links on to the profile for the rest.
 *
 * Deliberately not a single wrapping link: the card carries both that link and
 * one outbound link per mint, and nesting anchors is invalid markup that screen
 * readers announce as a single ambiguous target.
 */
export function BagsBuilderRow({
  entry,
  position,
}: {
  entry: BagsBoardEntry;
  position: number;
}) {
  // A builder can be on the launches board and in the hackathon cohort at once;
  // making people switch views to find that out would hide it from everyone
  // scanning this one.
  const hackathon = hackathonProjectsFor(entry.githubUsername);

  return (
    <li
      className="rounded-[20px] p-4 transition-colors hover:bg-[var(--bags-surface-hover)] sm:p-5"
      style={{
        backgroundColor: "var(--bags-surface)",
        border: "1px solid var(--bags-border)",
      }}
    >
      <div className="flex items-center gap-3 sm:gap-4">
        <span className="w-6 shrink-0 font-mono text-sm font-bold text-[var(--bags-text-faint)]">
          {String(position).padStart(2, "0")}
        </span>

        <Link
          href={`/bags/${entry.username}`}
          className="shrink-0"
          tabIndex={-1}
          aria-hidden="true"
        >
          {entry.avatarUrl ? (
            <Image
              src={entry.avatarUrl}
              alt=""
              width={44}
              height={44}
              className="h-11 w-11 rounded-full object-cover"
              style={{ border: "1px solid var(--bags-border)" }}
            />
          ) : (
            <div
              className="flex h-11 w-11 items-center justify-center rounded-full text-base font-bold text-[var(--bags-bg)]"
              style={{ backgroundColor: "var(--bags-green)" }}
            >
              {entry.username[0]?.toUpperCase()}
            </div>
          )}
        </Link>

        <div className="min-w-0 flex-1">
          <Link
            href={`/bags/${entry.username}`}
            className="truncate text-[16px] font-bold tracking-[-0.02em] text-[var(--bags-text)] hover:text-[var(--bags-green)]"
          >
            @{entry.username}
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[var(--bags-text-muted)]">
            {entry.githubUsername ? (
              <span className="inline-flex items-center gap-1">
                <GithubLogo size={12} weight="fill" />
                {entry.githubUsername}
              </span>
            ) : null}
            {entry.streak > 0 ? (
              <span className="inline-flex items-center gap-1">
                <Flame size={12} weight="fill" />
                {entry.streak}-day streak
              </span>
            ) : null}
            {hackathon.length > 0 ? (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                style={{
                  backgroundColor: "var(--bags-green-soft)",
                  color: "var(--bags-green)",
                }}
                title={hackathon.map((p) => p.name).join(", ")}
              >
                Bags Hackathon
              </span>
            ) : null}
            {/* Below sm the launch column is hidden, so the count lives here instead. */}
            <span className="sm:hidden">
              {entry.launchCount}{" "}
              {entry.launchCount === 1 ? "launch" : "launches"}
            </span>
          </div>
        </div>

        {/* Five columns do not fit a phone; the count moves into the meta line there. */}
        <div className="hidden shrink-0 text-right sm:block">
          <div className="font-mono text-xl font-extrabold leading-none text-[var(--bags-text)]">
            {entry.launchCount}
          </div>
          <div className="bags-label mt-1.5 text-[10px] font-semibold text-[var(--bags-text-faint)]">
            {entry.launchCount === 1 ? "launch" : "launches"}
          </div>
        </div>

        <div className="w-[76px] shrink-0 text-right">
          <div
            className="font-mono text-xl font-extrabold leading-none"
            style={{ color: "var(--bags-green)" }}
          >
            {entry.vibeScore}
          </div>
          <div className="bags-label mt-1.5 text-[10px] font-semibold text-[var(--bags-text-faint)]">
            vibe score
          </div>
        </div>
      </div>

      <ul className="mt-3 flex flex-wrap gap-2 pl-9 sm:pl-[52px]">
        {entry.mints.map((mint) => (
          <li key={mint}>
            <a
              href={`https://bags.fm/${mint}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`View ${shortMint(mint)} on Bags (opens in new tab)`}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-[11px] font-bold text-[var(--bags-green)] transition-opacity hover:opacity-75"
              style={{ backgroundColor: "var(--bags-green-soft)" }}
            >
              {shortMint(mint)}
              <ArrowUpRight size={11} weight="bold" />
            </a>
          </li>
        ))}
      </ul>
    </li>
  );
}
