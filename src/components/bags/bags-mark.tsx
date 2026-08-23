/**
 * The Bags money bag, in their lime.
 *
 * Drawn here rather than lifted from Bags' brand assets, so the page ships only
 * its own artwork. Used at 16px next to the data credit and at 30px in the
 * hero; one component so the two can never drift apart.
 *
 * Colours come from the .bags-theme scope, so this only renders correctly
 * inside it.
 */
export function BagsMark({
  size = 16,
  className = "shrink-0",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={className}
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
