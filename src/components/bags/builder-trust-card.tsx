import { SealCheck, Warning } from "@phosphor-icons/react/dist/ssr";

import type { BuilderTrust } from "@/lib/builder-trust";
import { focusLabel, type FocusSignal } from "@/lib/builder-focus";

export type BuilderTrustCardProps = {
  trust: BuilderTrust;
  /** Null when GitHub could not be reached, or the builder has no handle. */
  focus: FocusSignal | null;
  verifiedProjects: number;
  lifetimeContributions: number;
  longestStreak: number;
  memberSince: string;
};

/** "Mar 2026" — a join date needs no more precision than the month. */
function monthYear(iso: string): string | null {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? null
    : // Fixed to UTC: a timestamp just after midnight on the 1st would
      // otherwise render as the previous month wherever the server sits.
      date.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      });
}

/**
 * How much this builder's record is worth, in terms a visitor from Bags can
 * read without knowing what a vibe score is.
 *
 * Always shows the receipts under the headline. The rank is a summary of those
 * facts, and a summary nobody can check is just an assertion.
 */
export function BuilderTrustCard({
  trust,
  focus,
  verifiedProjects,
  lifetimeContributions,
  longestStreak,
  memberSince,
}: BuilderTrustCardProps) {
  const since = monthYear(memberSince);

  const receipts = [
    verifiedProjects > 0
      ? `${verifiedProjects} verified ${verifiedProjects === 1 ? "project" : "projects"}`
      : null,
    lifetimeContributions > 0
      ? `${lifetimeContributions.toLocaleString("en-US")} commits`
      : null,
    longestStreak > 0 ? `${longestStreak}-day best streak` : null,
    since ? `building since ${since}` : null,
  ].filter((r): r is string => r !== null);

  return (
    <section
      className="mt-6 rounded-[20px] p-5"
      style={{
        backgroundColor: "var(--bags-surface)",
        border: `1px solid ${trust.sufficient ? "var(--bags-border)" : "rgba(255, 200, 0, 0.28)"}`,
      }}
      aria-labelledby="trust-heading"
    >
      <div className="flex items-start gap-3">
        {trust.sufficient ? (
          <SealCheck
            weight="fill"
            size={20}
            className="mt-0.5 shrink-0"
            style={{ color: "var(--bags-green)" }}
          />
        ) : (
          <Warning
            weight="fill"
            size={20}
            className="mt-0.5 shrink-0"
            style={{ color: "#ffc800" }}
          />
        )}

        <div className="min-w-0">
          <h2
            id="trust-heading"
            className="text-[15px] font-bold tracking-[-0.02em] text-[var(--bags-text)]"
          >
            {trust.label}
          </h2>

          {trust.caveat ? (
            <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-[var(--bags-text-muted)]">
              {trust.caveat}
            </p>
          ) : null}

          {receipts.length > 0 ? (
            <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--bags-text-muted)]">
              {receipts.join(" · ")}
            </p>
          ) : null}

          {/*
            Volume says how much someone commits; this says where it lands. A
            builder with 800 commits across forty abandoned repos scores the
            same as one with 800 on the product they launched a token for, and
            on this page that is the difference worth showing.

            Shown with its inputs, never as a verdict: several repos is normal
            for anyone maintaining more than one thing, and a monorepo scores as
            perfectly focused for free.
          */}
          {focus && focusLabel(focus) ? (
            <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--bags-text-muted)]">
              <span className="font-bold text-[var(--bags-text)]">
                {focusLabel(focus)}
              </span>
              {" · "}
              {focus.concentration}% of {focus.pushes} recent pushes in{" "}
              <span className="break-all font-mono text-[12px]">
                {focus.topRepo}
              </span>
              {focus.repoCount > 1 ? `, across ${focus.repoCount} repos` : null}
            </p>
          ) : null}

          {/* The distinction the rest of this page depends on. A builder's
              record says nothing about how a coin is structured, and a reader
              who conflates the two is the one this page would have failed. */}
          <p className="mt-3 text-[11px] leading-relaxed text-[var(--bags-text-faint)]">
            Measures the builder, not the coin. Token risk is never folded into
            this.
          </p>
        </div>
      </div>
    </section>
  );
}
