import Image from "next/image";
import Link from "next/link";
import { ChainDot } from "./chain-dot";
import type { EnrichedPromotion } from "@/lib/featured-promotions";

function destinationFor(promo: EnrichedPromotion): { href: string; external: boolean } {
  if (promo.project?.live_url) return { href: promo.project.live_url, external: true };
  if (promo.author?.username) return { href: `/profile/${promo.author.username}`, external: false };
  return { href: `/explore?q=${encodeURIComponent(promo.projectName)}`, external: false };
}

export function FeaturedProjectCard({ promo }: { promo: EnrichedPromotion }) {
  const title = promo.project?.title || promo.projectName;
  const description = promo.project?.description || "";
  const imageUrl = promo.project?.image_url || null;
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
            alt=""
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
        {description && (
          <p className="mt-1 text-xs text-[var(--text-secondary)] line-clamp-2 leading-snug">
            {description}
          </p>
        )}

        <div className="flex-1 min-h-3" />

        <div
          className="mt-3 pt-3 flex items-center justify-between"
          style={{ borderTop: "1px solid var(--border-subtle)" }}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Network
          </span>
          <ChainDot chain="base" withLabel />
        </div>
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
