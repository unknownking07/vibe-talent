import localFont from "next/font/local";

/**
 * Open Runde, the face bags.fm itself serves.
 *
 * Self-hosted rather than linked: it is not on Google Fonts, and the strict
 * font-src CSP in next.config only allows our own origin. next/font emits the
 * files under /_next/static, which satisfies that without widening the policy.
 *
 * SIL Open Font License 1.1 (see OpenRunde-LICENSE.txt alongside the files),
 * which permits embedding and redistribution as long as the licence travels
 * with the font. It ships next to the woff2s for exactly that reason.
 *
 * Two weights only, ~310KB total. The family also publishes Medium and
 * Semibold, but they are another ~320KB for a single route: 600 and 800 fall to
 * Bold and 500 falls to Regular, which on a rounded face reads as intended.
 *
 * Scoped to /bags. Nothing else on the site loads it, and the rest of
 * VibeTalent stays on Geist.
 */
export const openRunde = localFont({
  src: [
    {
      path: "../../fonts/OpenRunde-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../fonts/OpenRunde-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-bags",
  display: "swap",
  // Bags' own stack falls back to the system UI face; matching it keeps the
  // pre-swap frame close in width to the final render.
  fallback: ["system-ui", "-apple-system", "Segoe UI", "sans-serif"],
});
