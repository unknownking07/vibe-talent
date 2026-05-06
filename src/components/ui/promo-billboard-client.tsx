"use client";

// Client island for the promo billboard marquee. Receives an SSR-resolved
// list of active promotions as a prop so first paint already has the right
// shape — no orange placeholder flashing in front of users.
//
// All we still need on the client is:
//   1. The infinite-scroll marquee CSS (animation only runs in the browser)
//   2. A timer that re-fetches the moment the soonest promotion expires so
//      the bar can disappear without a page refresh

import { useState, useEffect } from "react";
import Link from "next/link";
import { Flame, ExternalLink } from "lucide-react";
import {
  fetchPromotions,
  enrichPromotions,
  msUntilNextExpiry,
  type EnrichedPromotion,
} from "@/lib/featured-promotions";

const MIN_ITEMS_PER_LAP = 6;

const SCOPED_CSS = `
@keyframes promo-billboard-scroll {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}
.promo-billboard-marquee:hover .promo-billboard-track {
  animation-play-state: paused;
}
@media (prefers-reduced-motion: reduce) {
  .promo-billboard-track {
    animation: none !important;
  }
}
`;

function sortPromos(promos: EnrichedPromotion[]): EnrichedPromotion[] {
  return [...promos].sort((a, b) => {
    if (a.expiresAt === 0 && b.expiresAt !== 0) return -1;
    if (b.expiresAt === 0 && a.expiresAt !== 0) return 1;
    return b.paidAmount - a.paidAmount;
  });
}

interface PromoBillboardClientProps {
  initialPromos: EnrichedPromotion[];
}

export function PromoBillboardClient({ initialPromos }: PromoBillboardClientProps) {
  const [promos, setPromos] = useState<EnrichedPromotion[]>(() => sortPromos(initialPromos));

  useEffect(() => {
    let cancelled = false;
    let expiryTimer: ReturnType<typeof setTimeout> | undefined;

    // Schedule a re-fetch right after the soonest promotion expires so the
    // marquee disappears live. We re-run the enrichment client-side here
    // (the SSR seed is enough for first paint).
    const scheduleNext = (current: EnrichedPromotion[]) => {
      const delay = msUntilNextExpiry(current);
      if (delay !== null) {
        expiryTimer = setTimeout(reload, delay);
      }
    };

    const reload = () => {
      fetchPromotions()
        .then(enrichPromotions)
        .then((enriched) => {
          if (cancelled) return;
          const sorted = sortPromos(enriched);
          setPromos(sorted);
          scheduleNext(sorted);
        })
        .catch(() => {});
    };

    scheduleNext(promos);

    return () => {
      cancelled = true;
      if (expiryTimer) clearTimeout(expiryTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (promos.length === 0) return null;

  const lap: EnrichedPromotion[] = [];
  while (lap.length < MIN_ITEMS_PER_LAP) {
    lap.push(...promos);
  }

  return (
    <div
      className="promo-billboard-marquee"
      style={{
        backgroundColor: "var(--accent)",
        borderBottom: "2px solid var(--border-hard)",
        overflow: "hidden",
        position: "relative",
        height: 36,
      }}
      role="region"
      aria-label="Sponsored projects"
    >
      <style dangerouslySetInnerHTML={{ __html: SCOPED_CSS }} />

      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 2,
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "0 12px 0 14px",
          backgroundColor: "var(--accent)",
          color: "#0F0F0F",
          fontSize: 10,
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          borderRight: "2px solid var(--border-hard)",
          whiteSpace: "nowrap",
        }}
      >
        <Flame size={12} />
        <span>Sponsored</span>
      </div>

      <div
        className="promo-billboard-track"
        style={{
          display: "flex",
          width: "max-content",
          height: "100%",
          paddingLeft: 112,
          animation: "promo-billboard-scroll 45s linear infinite",
          willChange: "transform",
        }}
      >
        <PromoLap items={lap} />
        <PromoLap items={lap} ariaHidden />
      </div>
    </div>
  );
}

function PromoLap({ items, ariaHidden = false }: { items: EnrichedPromotion[]; ariaHidden?: boolean }) {
  return (
    <ul
      aria-hidden={ariaHidden}
      // `inert` on the duplicated lap removes the inner <a> elements from the
      // tab order so keyboard users don't focus links that are aria-hidden
      // from screen readers (WCAG 4.1.2). Supported as a JSX attribute since
      // React 19 (`@types/react` ≥ 19) — passes through to the DOM as
      // HTMLElement.inert when `true`.
      inert={ariaHidden}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 28,
        margin: 0,
        padding: "0 28px 0 0",
        listStyle: "none",
        whiteSpace: "nowrap",
        height: "100%",
      }}
    >
      {items.map((promo, idx) => (
        <PromoItem key={`${promo.id}-${idx}`} promo={promo} />
      ))}
    </ul>
  );
}

// Only treat the user-provided live_url as external when it parses as a real
// http/https URL. Anything else (including `javascript:` payloads) collapses
// to the internal-route fallback so we never inject an unsafe scheme into href.
function safeExternalHref(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:" ? raw : null;
  } catch {
    return null;
  }
}

function PromoItem({ promo }: { promo: EnrichedPromotion }) {
  const title = promo.project?.title || promo.projectName;
  const externalHref = safeExternalHref(promo.project?.live_url);
  const href = externalHref
    ?? (promo.author ? `/profile/${promo.author.username}` : `/explore?q=${encodeURIComponent(promo.projectName)}`);
  const isExternal = !!externalHref;

  const byline = promo.author ? `by @${promo.author.username}` : "sponsored";

  const linkStyle: React.CSSProperties = {
    color: "#0F0F0F",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.02em",
  };

  const inner = (
    <>
      <span style={{ fontWeight: 900 }}>{title}</span>
      <span style={{ opacity: 0.7, fontWeight: 600 }}>{byline}</span>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          fontWeight: 900,
          textDecoration: "underline",
          textUnderlineOffset: 3,
        }}
      >
        View Live <ExternalLink size={11} />
      </span>
    </>
  );

  return (
    <li style={{ display: "inline-flex", alignItems: "center" }}>
      {isExternal ? (
        <a href={href} target="_blank" rel="noopener noreferrer" style={linkStyle}>
          {inner}
        </a>
      ) : (
        // Internal route — use next/link to avoid a hard navigation.
        <Link href={href} style={linkStyle}>{inner}</Link>
      )}
    </li>
  );
}
