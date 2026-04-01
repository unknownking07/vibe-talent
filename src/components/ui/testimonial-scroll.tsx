"use client";

import { useState } from "react";
import { testimonials } from "@/data/testimonials";

export function TestimonialScroll() {
  const [isPaused, setIsPaused] = useState(false);

  const cards = [...testimonials, ...testimonials];

  return (
    <div
      className="relative overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
    >
      <div
        className="flex gap-5 testimonial-track"
        style={{
          animation: "testimonial-scroll 180s linear infinite",
          animationPlayState: isPaused ? "paused" : "running",
          width: "max-content",
        }}
      >
        {cards.map((t, i) => (
          <a
            key={`${t.handle}-${i}`}
            href={t.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 w-[420px] p-7 flex flex-col gap-4 transition-all hover:translate-y-[-2px]"
            style={{
              backgroundColor: "var(--bg-surface)",
              border: "2px solid var(--border-hard)",
              boxShadow: "var(--shadow-brutal-sm)",
            }}
          >
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://unavatar.io/x/${t.handle.replace("@", "")}`}
                alt={t.name}
                width={48}
                height={48}
                className="w-[48px] h-[48px] shrink-0 object-cover rounded-sm"
                style={{ border: "2px solid var(--border-hard)" }}
                onError={(e) => {
                  const el = e.currentTarget;
                  el.style.display = "none";
                  const fallback = el.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = "flex";
                }}
              />
              <div
                className="w-[48px] h-[48px] items-center justify-center text-sm font-extrabold text-white shrink-0 rounded-sm hidden"
                style={{ backgroundColor: "var(--bg-inverted)", border: "2px solid var(--border-hard)" }}
              >
                {t.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-extrabold text-[var(--foreground)] truncate">{t.name}</div>
                <div className="text-xs font-medium text-[var(--text-muted)] truncate">{t.handle}</div>
              </div>
              <svg aria-hidden="true" className="ml-auto shrink-0 text-[var(--text-muted)]" width={14} height={14} viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </div>
            <p className="text-base text-[var(--text-tertiary)] font-medium leading-relaxed line-clamp-3">
              &ldquo;{t.text}&rdquo;
            </p>
          </a>
        ))}
      </div>

      <style>{`
        @keyframes testimonial-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .testimonial-track {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
