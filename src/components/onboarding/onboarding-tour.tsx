"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, ExternalLink, X } from "lucide-react";
import { TOUR_CARDS, resolveCtaHref } from "./tour-cards";
import { TOUR_FLAG_ENABLED, markTourSeen } from "@/lib/onboarding";

interface OnboardingTourProps {
  /** Called when the user completes, skips, or dismisses the tour. */
  onClose: () => void;
  /**
   * Bypass the env-var feature flag. Used by the `?tour=force` dev-replay
   * path so we can preview the tour even on accounts that have already
   * dismissed it. In production this should never be set true unless the
   * flag is also on.
   */
  forceOpen?: boolean;
  /**
   * Logged-in user's username, passed in from the dashboard. Cards 4 and 6
   * use it to build `/profile/${username}` deep-links. Optional because the
   * dashboard may render before the profile finishes loading — `resolveCtaHref`
   * gracefully falls back to `/dashboard` in that window.
   */
  username?: string | null;
}

/**
 * Discord-style modal carousel. Walks new users through every core
 * VibeTalent feature in 10 cards. Mounted by the dashboard when the
 * `vibetalent_show_tour_after_redirect` sessionStorage flag is present
 * (set by the profile-setup wizard) or when `?tour=force` is in the URL.
 *
 * Owns minimal state: card index + open flag. All persistence lives in
 * `@/lib/onboarding` so other entry points (the navbar replay button) can
 * coordinate without re-implementing the contract.
 */
export function OnboardingTour({ onClose, forceOpen = false, username }: OnboardingTourProps) {
  const router = useRouter();
  const [cardIndex, setCardIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(true);

  /**
   * Mark the tour as completed and tear down the modal. We do this on:
   *  - X button click
   *  - Skip link click
   *  - final card's CTA
   *  - Escape key
   *  - backdrop click
   *  - any "Take me there" CTA (engagement = seen)
   *
   * Tour is "seen" the moment the user engages — re-prompting after they've
   * navigated away would feel like nagging.
   */
  const completeTour = useCallback(() => {
    markTourSeen();
    setIsOpen(false);
    onClose();
  }, [onClose]);

  // Escape-to-dismiss. Mirrors the implicit accessibility pattern used by
  // every other modal in the app — users expect this and screen readers
  // depend on it as the modal-dismiss affordance.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") completeTour();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, completeTour]);

  // Lock body scroll while the modal is open. Without this, mobile users can
  // scroll the dashboard underneath through the backdrop, which feels broken.
  // Restore the previous overflow value on unmount so we don't trample anyone
  // else (e.g., if another modal is open, though we shouldn't stack here).
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  // Feature flag is checked AFTER hooks so we don't violate the rules of
  // hooks. The early return below is the actual gate.
  if (!TOUR_FLAG_ENABLED && !forceOpen) return null;
  if (!isOpen) return null;

  const card = TOUR_CARDS[cardIndex];
  const Icon = card.icon;
  const isFirst = cardIndex === 0;
  const isLast = cardIndex === TOUR_CARDS.length - 1;

  const next = () => {
    if (isLast) {
      completeTour();
    } else {
      setCardIndex((i) => i + 1);
    }
  };

  const prev = () => {
    setCardIndex((i) => Math.max(0, i - 1));
  };

  const handleCta = () => {
    const href = resolveCtaHref(card.ctaHref, username);
    if (href === null) {
      // Internal-advance card (Welcome, Earn Your Badge, final).
      next();
      return;
    }
    completeTour();
    router.push(href);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-tour-title"
    >
      {/* Backdrop. Click closes. Mirrors hire-modal.tsx:148-151. */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={completeTour}
        aria-hidden="true"
      />

      {/* Card. Same brutal-shadow + warm-grey treatment as the rest of the app. */}
      <div
        className="relative w-full max-w-lg max-h-[90dvh] overflow-y-auto animate-scale-in"
        style={{
          maxHeight: "90vh", // legacy fallback for browsers without dvh support
          backgroundColor: "var(--bg-surface)",
          border: "2px solid var(--border-hard)",
          boxShadow: "var(--shadow-brutal)",
        }}
      >
        {/* Top bar: progress label + skip + close.
            Skip stays in the top-right on mobile so it's always reachable
            without scrolling — long cards on small viewports otherwise hide
            the bottom bar. */}
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderBottom: "2px solid var(--border-hard)" }}
        >
          <span className="text-xs font-extrabold uppercase tracking-wider text-[var(--text-muted)]">
            {cardIndex + 1} of {TOUR_CARDS.length}
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={completeTour}
              className="text-xs font-extrabold uppercase tracking-wide text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-colors"
            >
              Skip
            </button>
            <button
              type="button"
              onClick={completeTour}
              aria-label="Close tour"
              className="w-8 h-8 flex items-center justify-center text-[var(--foreground)] transition-all hover:bg-[var(--bg-surface-light)]"
              style={{ border: "2px solid var(--border-hard)" }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body. The `key={cardIndex}` re-mounts the inner div on every
            transition so animate-fade-in-up retriggers — pure CSS, no JS
            timing required. */}
        <div key={cardIndex} className="animate-fade-in-up tour-card-content p-6 sm:p-8">
          {/* Hero icon */}
          <div
            className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 mb-4"
            style={{
              backgroundColor: "var(--accent)",
              color: "var(--text-on-inverted)",
              border: "2px solid var(--border-hard)",
              boxShadow: "var(--shadow-brutal-sm)",
            }}
          >
            <Icon size={24} className="sm:hidden" />
            <Icon size={28} className="hidden sm:block" />
          </div>

          <h2
            id="onboarding-tour-title"
            className="text-2xl sm:text-3xl font-extrabold uppercase tracking-tight text-[var(--foreground)] mb-3"
          >
            {card.title}
          </h2>
          <p className="text-sm sm:text-base text-[var(--text-secondary)] font-medium leading-relaxed mb-6">
            {card.body}
          </p>

          {/* CTA + Back. Stack vertically on mobile so neither button is
              cramped at small widths. Back is hidden on the first card. */}
          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
            <button
              type="button"
              onClick={prev}
              disabled={isFirst}
              className="btn-brutal text-sm flex items-center gap-2 justify-center disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ visibility: isFirst ? "hidden" : "visible" }}
              aria-hidden={isFirst}
            >
              <ArrowLeft size={14} />
              Back
            </button>

            <button
              type="button"
              onClick={handleCta}
              className="btn-brutal btn-brutal-primary text-sm flex items-center gap-2 justify-center"
            >
              {card.ctaLabel}
              <ArrowRight size={14} />
            </button>
          </div>

          {/* Learn more link — small, secondary, opens GitBook in a new tab.
              rel includes noopener+noreferrer for the standard tab-nabbing
              defense. */}
          <div className="mt-4 text-center">
            <a
              href={card.learnMoreHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
            >
              Learn more
              <ExternalLink size={12} />
            </a>
          </div>
        </div>

        {/* Pagination dots. Compress on mobile (4px) → desktop (6px). Active
            dot uses the accent color; the rest use the muted border so they
            read as a quiet progress bar rather than a competing visual. */}
        <div
          className="flex items-center justify-center gap-1.5 px-5 py-4"
          style={{ borderTop: "2px solid var(--border-hard)" }}
          role="tablist"
          aria-label="Tour progress"
        >
          {TOUR_CARDS.map((_, i) => {
            const active = i === cardIndex;
            // Visible dot stays small (6×6 / 18×6 active) but the button
            // itself has a generous padding so the click target meets the
            // WCAG 2.1 AA minimum (24×24 CSS pixels). Without this the dots
            // are nearly impossible to hit on mobile.
            return (
              <button
                key={i}
                type="button"
                onClick={() => setCardIndex(i)}
                role="tab"
                aria-selected={active}
                aria-label={`Go to card ${i + 1}`}
                className="flex items-center justify-center"
                style={{
                  width: 24,
                  height: 24,
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                }}
              >
                <span
                  className="block transition-all"
                  style={{
                    width: active ? 18 : 6,
                    height: 6,
                    backgroundColor: active ? "var(--accent)" : "var(--border-hard)",
                    opacity: active ? 1 : 0.4,
                  }}
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
