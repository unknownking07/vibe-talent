import { BagsMark } from "./bags-mark";

/**
 * Source credit for the launch data on this page.
 *
 * Deliberately a small credit rather than a Bags wordmark: this is a
 * VibeTalent page ABOUT Bags, built on their ecosystem for their hackathon.
 * Their lettering leading the page would read as an official Bags surface,
 * which is a different claim from the one the copy beside it makes.
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
