"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
import { FeatureYourProjectCard } from "./feature-your-project-card";

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
            <div className="md:col-span-2 lg:col-span-1">
              <FeatureYourProjectCard
                ref={featureCardRef}
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
