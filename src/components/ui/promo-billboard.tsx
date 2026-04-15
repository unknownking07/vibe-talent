"use client";

// Thin single-line infinite-marquee billboard rendered at the very top of
// every page. Auto-fetches on-chain paid promotions and scrolls them
// horizontally so sponsored projects get above-the-fold visibility across the
// entire site (not just the homepage carousel).
//
// All styling is inline / in a scoped <style> block because Tailwind v4's
// compile pipeline was dropping custom classes we added to globals.css — this
// makes the component self-contained and immune to that issue.

import { useState, useEffect } from "react";
import { Flame, ExternalLink } from "lucide-react";
import { fetchPromotions, enrichPromotions, type EnrichedPromotion } from "@/lib/featured-promotions";

// Pad the promo list up to this count so the marquee row feels full even when
// only 1-2 projects are currently promoted. Each copy is rendered once per
// "lap" (we render two laps back-to-back to make the loop seamless).
const MIN_ITEMS_PER_LAP = 6;

// Scoped CSS — injected once. Keyframes + hover pause + reduced-motion guard.
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

export function PromoBillboard() {
  const [promos, setPromos] = useState<EnrichedPromotion[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchPromotions()
      .then(enrichPromotions)
      .then((enriched) => {
        if (cancelled) return;
        setPromos(sortPromos(enriched));
        setLoaded(true);
      })
      .catch(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  // Reserve the 36px of vertical space even while promos are loading so the
  // rest of the page doesn't reflow when the billboard pops in (avoids CLS).
  // When no promos are active, we collapse to null so the bar doesn't occupy
  // space unnecessarily.
  if (!loaded) {
    return (
      <div
        aria-hidden
        style={{
          height: 36,
          backgroundColor: "var(--accent)",
          borderBottom: "2px solid var(--border-hard)",
        }}
      />
    );
  }

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

      {/* Anchored SPONSORED tag — stays pinned left while the marquee scrolls underneath */}
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

      {/* Marquee track — two copies side-by-side, translated -50% for a seamless loop */}
      <div
        className="promo-billboard-track"
        style={{
          display: "flex",
          width: "max-content",
          height: "100%",
          paddingLeft: 112, // clears the anchored SPONSORED tag
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

function PromoItem({ promo }: { promo: EnrichedPromotion }) {
  const title = promo.project?.title || promo.projectName;
  const href = promo.project?.live_url
    ?? (promo.author ? `/profile/${promo.author.username}` : `/explore?q=${encodeURIComponent(promo.projectName)}`);
  const isExternal = !!promo.project?.live_url;

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
        <a href={href} style={linkStyle}>{inner}</a>
      )}
    </li>
  );
}
