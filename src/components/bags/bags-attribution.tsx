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
      // The words "Launch data from" already precede this link in the page copy.
      aria-label="bags.fm (opens in new tab)"
      // Plain inline, NOT inline-flex. An inline-flex box aligns the line by its
      // own flex baseline, so a 16px mark inside 12px text lifted "bags.fm" off
      // the baseline of the sentence around it. As inline text it sits on the
      // parent's baseline and only the glyph is nudged.
      className={`whitespace-nowrap text-[12px] font-bold text-[var(--bags-text-muted)] transition-colors hover:text-[var(--bags-text)] ${className}`}
    >
      <BagsMark size={14} className="mr-1 inline-block align-[-0.2em]" />
      bags.fm
    </a>
  );
}
