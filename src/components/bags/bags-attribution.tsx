/**
 * Source credit for the launch data on this page.
 *
 * Deliberately small and attributive rather than a wordmark in the hero: this
 * is a VibeTalent page ABOUT Bags, not a Bags page, and the disclaimer at the
 * foot says we are not affiliated with them. A logo leading the page would
 * quietly contradict that.
 *
 * The glyph is drawn here rather than lifted from their brand assets, so the
 * page ships nothing but its own artwork.
 */
export function BagsAttribution({ className = "" }: { className?: string }) {
  return (
    <a
      href="https://bags.fm"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Launch data from bags.fm (opens in new tab)"
      className={`inline-flex items-center gap-1.5 text-[12px] font-bold text-[var(--bags-text-muted)] transition-colors hover:text-[var(--bags-text)] ${className}`}
    >
      <BagsMark />
      bags.fm
    </a>
  );
}

/** A money bag in Bags' lime, sized to sit on a line of text. */
function BagsMark({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className="shrink-0"
    >
      {/*
        One path, not two. Drawn as separate neck and body shapes the join left
        a visible seam at this size and the neck read as a second blob sitting
        on top rather than a tied-off top.

        The neck is narrow and the body flares low and wide, which is what makes
        the silhouette read as a bag at 16px rather than as a circle.
      */}
      <path
        d="M9.35 2.4h5.3a.85.85 0 0 1 .74 1.27l-1.2 2.1c3.66 1.9 6.31 5.28 6.31 8.86 0 4.02-3.8 6.97-8.5 6.97s-8.5-2.95-8.5-6.97c0-3.58 2.65-6.96 6.31-8.86l-1.2-2.1A.85.85 0 0 1 9.35 2.4Z"
        fill="var(--bags-green)"
      />
      {/*
        Currency mark knocked out of the bag. Sized and centred against the body
        rather than the viewBox: the body's optical centre sits below the middle
        because the neck occupies the top quarter.
      */}
      <text
        x="12"
        y="18.4"
        textAnchor="middle"
        fontSize="12.5"
        fontWeight="700"
        fill="var(--bags-bg)"
        fontFamily="var(--font-bags), system-ui, sans-serif"
      >
        $
      </text>
    </svg>
  );
}
