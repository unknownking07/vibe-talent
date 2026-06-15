import type { Metadata } from "next";

// Share routes (/share/...) are social-unfurl targets — they exist to render
// OG/Twitter cards when a builder shares an achievement, weekly recap, shipped
// project, or custom card. Their content mirrors the canonical profile/project
// pages, so letting Google index them creates thin duplicates and dilutes
// crawl budget. noindex keeps them out of search; `follow` lets link equity
// flow back to the real profiles. OG/Twitter tags still render for the cards —
// crawlers read those regardless of the robots directive.
export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return children;
}
