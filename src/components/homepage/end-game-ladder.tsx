/**
 * End-game ladder — the 4-step path from signup to getting hired.
 *
 * Why this exists: Meta Alchemist's feedback called out that the homepage
 * doesn't communicate the "end game" clearly. The hero says "marketplace
 * built on consistency and proof of work" but never finishes the sentence.
 * This component is the missing second half: here's exactly how a builder
 * goes from signup to a hire request.
 *
 * Placement: directly below the live feed reinforcement banner, so the
 * narrative reads as "look at the activity → here's your path into it."
 *
 * Design notes:
 *   - Server component, no JS bundle.
 *   - 4 columns on desktop (>= sm), stacked on mobile.
 *   - The final "Get Hired" step is visually emphasized (accent background)
 *     because it's the actual end-state — every other step is a means.
 *   - Arrows render only on desktop. On mobile we drop them to keep the
 *     vertical stack tight; the order is implicit from top-to-bottom.
 */

import { Fragment } from "react";
import Link from "next/link";
import { ArrowRight, Github, Flame, Trophy, Mail } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Step {
  number: string;
  title: string;
  body: string;
  icon: LucideIcon;
  /** True for the terminal "GET HIRED" step — gets accent styling so it
   *  reads as the destination rather than another waypoint. */
  isTerminal?: boolean;
}

const STEPS: readonly Step[] = [
  {
    number: "01",
    title: "Sign up",
    body: "Connect your GitHub in 60 seconds. No resume, no portfolio.",
    icon: Github,
  },
  {
    number: "02",
    title: "Ship daily",
    body: "Commit every day. Streaks auto-detect from your GitHub activity.",
    icon: Flame,
  },
  {
    number: "03",
    title: "Climb the score",
    body: "Streaks + project quality + endorsements = your vibe score.",
    icon: Trophy,
  },
  {
    number: "04",
    title: "Get hired",
    body: "Founders DM the top builders. Skip the resume gauntlet.",
    icon: Mail,
    isTerminal: true,
  },
];

export function EndGameLadder() {
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 pb-14 sm:pb-20">
      <div className="text-center mb-10">
        <div
          className="inline-flex items-center gap-2 mb-3 px-3 py-1 text-xs font-extrabold uppercase tracking-wider"
          style={{
            backgroundColor: "var(--bg-surface)",
            color: "var(--foreground)",
            border: "2px solid var(--border-hard)",
            boxShadow: "var(--shadow-brutal-sm)",
          }}
        >
          How it works
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold uppercase tracking-tight text-[var(--foreground)]">
          Four steps to
          <span className="text-accent-brutal"> getting hired.</span>
        </h2>
        <p className="mt-3 text-sm sm:text-base text-[var(--text-secondary)] font-medium max-w-xl mx-auto">
          No applications. No interviews until you&apos;re ready. Just consistent
          shipping that founders can verify on their own.
        </p>
      </div>

      {/* Steps. Grid on desktop with arrows between, vertical stack on
          mobile. The arrow column is fixed-width so the steps line up
          regardless of step-text length. */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] gap-4 sm:gap-3 items-stretch">
        {STEPS.map((step, idx) => (
          // Fragment needs the key (not the children) — React's reconciler
          // tracks the outermost element in a list iteration.
          <Fragment key={step.number}>
            <StepCard step={step} />
            {/* Arrow between cards — only rendered on desktop, only between
                pairs (not after the final step). */}
            {idx < STEPS.length - 1 && (
              <div
                className="hidden sm:flex items-center justify-center text-[var(--text-muted)]"
                aria-hidden="true"
              >
                <ArrowRight size={20} strokeWidth={2.5} />
              </div>
            )}
          </Fragment>
        ))}
      </div>

      {/* Bottom CTA — gives the ladder a clear close-out instead of just
          dangling. Same destination as the hero's primary CTA so we don't
          fork the funnel. */}
      <div className="mt-10 text-center">
        <Link
          href="/auth/signup"
          className="btn-brutal btn-brutal-primary text-sm sm:text-base inline-flex"
        >
          Start your streak today
          <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  );
}

function StepCard({ step }: { step: Step }) {
  const Icon = step.icon;
  const terminal = step.isTerminal === true;

  return (
    <article
      className="p-5 sm:p-6 flex flex-col gap-3"
      style={{
        backgroundColor: terminal ? "var(--accent)" : "var(--bg-surface)",
        color: terminal ? "var(--text-on-inverted)" : "var(--foreground)",
        border: "2px solid var(--border-hard)",
        boxShadow: "var(--shadow-brutal-sm)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className="text-xs font-extrabold tracking-widest tabular-nums opacity-70"
        >
          {step.number}
        </span>
        <Icon size={20} className="flex-shrink-0" strokeWidth={2.25} />
      </div>
      <div>
        <div className="text-lg sm:text-xl font-extrabold uppercase tracking-tight">
          {step.title}
        </div>
        <p
          className="mt-1.5 text-sm font-medium leading-snug"
          style={{ opacity: terminal ? 0.95 : 0.85 }}
        >
          {step.body}
        </p>
      </div>
    </article>
  );
}
