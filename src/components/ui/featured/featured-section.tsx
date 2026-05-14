"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import { Megaphone, ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  fetchPromotions,
  enrichPromotions,
  msUntilNextExpiry,
  type EnrichedPromotion,
} from "@/lib/featured-promotions";
import { FeaturedProjectCard } from "./featured-project-card";
import { EmptySlotCard } from "./empty-slot-card";

// Lazy-loaded so the Privy / WalletConnect / Coinbase / Solana / viem stack
// (~60 chunks) stays out of the homepage's critical path. The placeholder
// matches the real card's dimensions to avoid CLS when it swaps in.
const FeatureYourProjectCard = dynamic(
  () => import("./feature-your-project-card").then((m) => ({ default: m.FeatureYourProjectCard })),
  {
    ssr: false,
    loading: () => (
      <div
        role="status"
        aria-busy="true"
        aria-label="Loading promote-your-project card"
        className="card-brutal relative p-6 flex flex-col md:min-h-[420px] overflow-hidden"
        style={{ backgroundColor: "var(--bg-surface)" }}
      >
        <h3 className="text-2xl font-extrabold uppercase leading-tight">
          <span className="block text-[var(--foreground)]">Feature</span>
          <span className="block" style={{ color: "var(--accent)" }}>Your Project</span>
        </h3>
        <div className="mt-6 space-y-3">
          <div
            className="h-3 w-3/4 animate-pulse"
            style={{ backgroundColor: "var(--border-subtle)" }}
          />
          <div
            className="h-3 w-2/3 animate-pulse"
            style={{ backgroundColor: "var(--border-subtle)" }}
          />
        </div>
      </div>
    ),
  },
);

const SLOTS_PER_PAGE = 2;

export function FeaturedSection() {
  const [promotions, setPromotions] = useState<EnrichedPromotion[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const pausedRef = useRef(false);
  const featureCardRef = useRef<HTMLDivElement>(null);

  // Supabase auth check — only gates the claim-flow UX inside the
  // FeatureYourProjectCard, NOT the public promotions fetch below.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsLoggedIn(!!user);
    });
  }, []);

  const refreshPromotions = useCallback(() => {
    fetchPromotions()
      .then((raw) => enrichPromotions(raw))
      .then((enriched) => {
        setPromotions(enriched);
        setLoading(false);
      })
      .catch(() => {
        setPromotions([]);
        setLoading(false);
      });
  }, []);

  // Public RPC call + public Supabase reads — fire immediately, don't wait
  // for auth round-trip. Otherwise crawlers and signed-out visitors see an
  // empty section until the auth check resolves.
  useEffect(() => {
    refreshPromotions();
  }, [refreshPromotions]);

  // Re-fetch when the soonest non-lifetime promotion expires
  useEffect(() => {
    const delay = msUntilNextExpiry(promotions);
    if (delay === null) return;
    const timer = setTimeout(refreshPromotions, delay);
    return () => clearTimeout(timer);
  }, [promotions, refreshPromotions]);

  const totalPages = Math.max(1, Math.ceil(promotions.length / SLOTS_PER_PAGE));
  const needsPagination = promotions.length > SLOTS_PER_PAGE;
  const effectivePage = page >= totalPages ? 0 : page;

  // Auto-advance pages every 8s (paused on hover/focus). Wrap-around math
  // self-corrects if `page` is stale relative to `totalPages`.
  useEffect(() => {
    if (!needsPagination) return;
    const id = setInterval(() => {
      if (!pausedRef.current) setPage((p) => (p + 1) % totalPages);
    }, 8000);
    return () => clearInterval(id);
  }, [needsPagination, totalPages]);

  const visibleSlots = useMemo<(EnrichedPromotion | null)[]>(() => {
    const start = effectivePage * SLOTS_PER_PAGE;
    return [promotions[start] ?? null, promotions[start + 1] ?? null];
  }, [promotions, effectivePage]);

  const prev = useCallback(() => {
    setPage((p) => (p - 1 + totalPages) % totalPages);
  }, [totalPages]);

  const next = useCallback(() => {
    setPage((p) => (p + 1) % totalPages);
  }, [totalPages]);

  const handleClaim = useCallback(() => {
    const node = featureCardRef.current;
    if (!node) return;
    node.scrollIntoView({ behavior: "smooth", block: "center" });
    node.focus({ preventScroll: true });
    // Briefly pulse the card so users see where the click landed — without
    // this, if both cards already share a viewport, the click looks dead.
    // The offsetWidth read forces a synchronous reflow between remove + add
    // so the browser registers a class change instead of batching the two
    // ops into a no-op (the canonical "restart CSS animation" pattern).
    // rAF would also work but stalls on hidden tabs; reflow is universal.
    // setTimeout cleanup matches the 1.2s animation + buffer, and also
    // handles the prefers-reduced-motion path where no animationend fires
    // (the static outline stays visible until the class is removed).
    node.classList.remove("claim-pulse");
    void node.offsetWidth;
    node.classList.add("claim-pulse");
    window.setTimeout(() => node.classList.remove("claim-pulse"), 1400);
  }, []);

  return (
    <section
      id="featured-projects"
      style={{
        borderTop: "2px solid var(--border-hard)",
        borderBottom: "2px solid var(--border-hard)",
        backgroundColor: "var(--bg-surface)",
      }}
    >
      {/* Pause boundary wraps BOTH the header (with prev/next buttons) and the
          card grid, so keyboard focus on pagination controls also pauses
          autoplay. Previously these handlers lived only on the inner grid. */}
      <div
        className="mx-auto max-w-7xl px-4 sm:px-6 py-12"
        onMouseEnter={() => {
          pausedRef.current = true;
        }}
        onMouseLeave={() => {
          pausedRef.current = false;
        }}
        onFocusCapture={() => {
          pausedRef.current = true;
        }}
        onBlurCapture={() => {
          pausedRef.current = false;
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Megaphone size={20} style={{ color: "var(--accent)" }} />
            <h2 className="text-xl font-extrabold uppercase text-[var(--foreground)]">
              Featured Projects
            </h2>
            <span
              className="font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5"
              style={{ backgroundColor: "var(--accent)", color: "white" }}
            >
              Sponsored
            </span>
          </div>
          {needsPagination && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={prev}
                className="p-2 transition-all hover:translate-x-[-2px] hover:translate-y-[-2px]"
                style={{
                  border: "2px solid var(--border-hard)",
                  boxShadow: "var(--shadow-brutal-xs)",
                  backgroundColor: "var(--bg-surface)",
                }}
                aria-label="Previous featured projects"
              >
                <ChevronLeft size={16} style={{ color: "var(--foreground)" }} />
              </button>
              <button
                type="button"
                onClick={next}
                className="p-2 transition-all hover:translate-x-[2px] hover:translate-y-[-2px]"
                style={{
                  border: "2px solid var(--border-hard)",
                  boxShadow: "var(--shadow-brutal-xs)",
                  backgroundColor: "var(--bg-surface)",
                }}
                aria-label="Next featured projects"
              >
                <ChevronRight size={16} style={{ color: "var(--foreground)" }} />
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div
            className="p-8 text-center"
            style={{
              border: "2px solid var(--border-hard)",
              boxShadow: "var(--shadow-brutal-sm)",
              backgroundColor: "var(--bg-surface)",
            }}
          >
            <p className="text-sm font-bold uppercase text-[var(--text-muted)] animate-pulse">
              Loading promotions...
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            {visibleSlots.map((slot, idx) =>
              slot ? (
                <FeaturedProjectCard key={slot.id} promo={slot} />
              ) : (
                <EmptySlotCard key={`empty-${idx}`} onClaim={handleClaim} />
              ),
            )}
            {/* Ref lives on the wrapper, not the card, because next/dynamic
                doesn't forward refs. The wrapper has the card's exact bounds
                (no extra padding / borders), so the .claim-pulse outline and
                scrollIntoView target stay visually identical. */}
            <div
              ref={featureCardRef}
              tabIndex={-1}
              className="md:col-span-2 lg:col-span-1 focus:outline-none"
            >
              <FeatureYourProjectCard
                onSuccess={refreshPromotions}
                isLoggedIn={isLoggedIn}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
