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
function BagsMark({ size = 15 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {/* Neck: the tied-off top of the bag. */}
      <path
        d="M9.1 2.6h5.8a.7.7 0 0 1 .62 1.03l-1.06 2.0H9.54L8.48 3.63A.7.7 0 0 1 9.1 2.6Z"
        fill="var(--bags-green)"
      />
      {/* Body: wider at the base, the way a full bag sits. */}
      <path
        d="M9.9 6.4h4.2c3.1 1.7 5.6 4.9 5.6 8.4 0 3.9-3.4 6.6-7.7 6.6s-7.7-2.7-7.7-6.6c0-3.5 2.5-6.7 5.6-8.4Z"
        fill="var(--bags-green)"
      />
      {/* Currency mark, knocked out of the bag rather than drawn over it. */}
      <text
        x="12"
        y="17.4"
        textAnchor="middle"
        fontSize="9.5"
        fontWeight="800"
        fill="var(--bags-bg)"
        fontFamily="var(--font-bags), system-ui, sans-serif"
      >
        $
      </text>
    </svg>
  );
}
