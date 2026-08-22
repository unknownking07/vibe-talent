import Link from "next/link";
import { GithubLogo, SealCheck } from "@phosphor-icons/react/dist/ssr";

import type { HackathonProject } from "@/lib/hackathon-projects";

/** A hackathon entry, with the builder behind it when we can prove who that is. */
export type RosterEntry = {
  project: HackathonProject;
  /** Set only when a VibeTalent profile is GitHub-verified as this owner. */
  builder: { username: string; vibeScore: number } | null;
};

/**
 * The Bags Hackathon cohort.
 *
 * Every entry is listed, matched or not. Showing only the matched ones would
 * turn a roster of 45 projects into a list of the two builders who happen to be
 * on VibeTalent, which is a claim about us rather than about the hackathon.
 *
 * The badge is the only thing that varies, and it means one specific thing: a
 * VibeTalent profile is GitHub-verified as the owner of that submission's
 * repository. It is not a placement, a score, or a statement about any token.
 */
export function HackathonRoster({ entries }: { entries: RosterEntry[] }) {
  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {entries.map(({ project, builder }) => (
        <li
          key={`${project.githubOwner}-${project.name}`}
          className="flex items-start justify-between gap-3 rounded-2xl p-4"
          style={{
            backgroundColor: "var(--bags-surface)",
            border: `1px solid ${builder ? "rgba(0, 255, 0, 0.22)" : "var(--bags-border)"}`,
          }}
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-[14px] font-bold text-[var(--bags-text)]">
                {project.name}
              </span>
              {project.winner ? (
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em]"
                  style={{
                    backgroundColor: "rgba(255, 200, 0, 0.16)",
                    color: "#ffc800",
                  }}
                >
                  Winner
                </span>
              ) : null}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--bags-text-muted)]">
              <span>{project.track}</span>
              {project.githubOwner ? (
                <span className="inline-flex items-center gap-1">
                  <GithubLogo size={11} weight="fill" />
                  {project.githubOwner}
                </span>
              ) : (
                <span>announced, no submission</span>
              )}
            </div>
          </div>

          {builder ? (
            <Link
              href={`/profile/${builder.username}`}
              className="shrink-0 text-right"
              aria-label={`${project.name} was built by @${builder.username}, a verified VibeTalent builder`}
            >
              <span
                className="inline-flex items-center gap-1 text-[11px] font-bold"
                style={{ color: "var(--bags-green)" }}
              >
                <SealCheck size={11} weight="fill" />@{builder.username}
              </span>
              <span className="mt-0.5 block font-mono text-[11px] text-[var(--bags-text-faint)]">
                {builder.vibeScore} vibe score
              </span>
            </Link>
          ) : (
            <span className="shrink-0 text-[11px] text-[var(--bags-text-faint)]">
              {project.githubOwner ? "not on VibeTalent" : "not matchable"}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
