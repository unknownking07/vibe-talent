import Image from "next/image";
import Link from "next/link";
import type { EnrichedPromotion } from "@/lib/featured-promotions";

// Reject anything that isn't plain http(s). User-submitted live_url values
// could otherwise carry javascript:/data:/file: schemes that execute on click.
function isSafeHttpUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

function destinationFor(promo: EnrichedPromotion): { href: string; external: boolean } {
  const liveUrl = promo.project?.live_url;
  if (liveUrl && isSafeHttpUrl(liveUrl)) return { href: liveUrl, external: true };
  if (promo.author?.username) return { href: `/profile/${promo.author.username}`, external: false };
  return { href: `/explore?q=${encodeURIComponent(promo.projectName)}`, external: false };
}

// How many tech-stack pills to surface inline before collapsing to "+N".
// Four keeps the row to one line on the typical card width.
const MAX_TECH_PILLS = 4;

export function FeaturedProjectCard({ promo }: { promo: EnrichedPromotion }) {
  const title = promo.project?.title || promo.projectName;
  const description = promo.project?.description || "";
  const imageUrl = promo.project?.image_url || null;
  const username = promo.author?.username || null;
  // Dedupe — tech_stack is just a string[] with no uniqueness constraint, so
  // duplicates from the source data would render duplicate pills AND collide
  // on the React key. Set preserves insertion order.
  const techStack = Array.from(new Set(promo.project?.tech_stack ?? []));
  const { href, external } = destinationFor(promo);

  const linkProps = external
    ? { href, target: "_blank" as const, rel: "noopener noreferrer" }
    : { href };

  const LinkComponent = external ? "a" : Link;

  return (
    <article
      className="featured-card card-brutal relative overflow-hidden flex flex-col md:min-h-[420px]"
      style={{ backgroundColor: "var(--bg-surface)" }}
    >
      <LinkComponent
        {...linkProps}
        className="absolute inset-0 z-10 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-[var(--accent)]"
        aria-label={`View ${title}`}
      >
        <span className="sr-only">View project</span>
      </LinkComponent>

      {/* Image area */}
      <div
        className="relative h-44 lg:h-48 border-b-2 border-[var(--border-hard)] shrink-0"
        style={{ backgroundColor: "hsl(14, 6%, 12%)" }}
      >
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={title}
            fill
            className="object-cover object-top"
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className="text-6xl font-extrabold uppercase opacity-20 select-none tracking-widest"
              style={{ color: "hsl(14, 6%, 30%)" }}
            >
              {title.charAt(0)}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            <span className="live-dot" /> Live
          </span>
        </div>
        <h3 className="mt-2 text-base font-extrabold uppercase text-[var(--foreground)] line-clamp-1 leading-tight">
          {title}
        </h3>
        {username && (
          <p className="mt-0.5 text-[11px] font-mono text-[var(--text-muted)] line-clamp-1">
            @{username}
          </p>
        )}
        {description && (
          <p className="mt-2 text-xs text-[var(--text-secondary)] line-clamp-2 leading-snug">
            {description}
          </p>
        )}
        {/* Tech stack — plain text pills are kept non-interactive on purpose.
            The whole-card link captures clicks (rendering nested anchors here
            would break HTML semantics and the focus order). mt-auto pushes
            this row to the bottom of the content area so it fills the space
            the old Network row used to occupy. */}
        {techStack.length > 0 && (
          <div className="mt-auto pt-4 flex flex-wrap gap-1.5">
            {techStack.slice(0, MAX_TECH_PILLS).map((tech) => (
              <span
                key={tech}
                className="px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider text-[var(--text-muted)]"
                style={{
                  backgroundColor: "var(--bg-surface-light)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                {tech}
              </span>
            ))}
            {techStack.length > MAX_TECH_PILLS && (
              <span className="px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider text-[var(--text-muted)]">
                +{techStack.length - MAX_TECH_PILLS}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Hover/focus overlay — see .featured-card-overlay in globals.css */}
      <div className="featured-card-overlay">
        <span className="btn-brutal btn-brutal-primary btn-notched text-xs px-5 py-2.5 uppercase font-extrabold">
          View Project
        </span>
      </div>
    </article>
  );
}
