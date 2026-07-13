import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Support",
  description:
    "Get instant answers about VibeTalent — vibe scores, streaks, projects, hiring, badges, and your account.",
  robots: { index: false, follow: false }, // client-only chat surface, not an SEO page
};

export default function SupportLayout({ children }: { children: React.ReactNode }) {
  // `.chat-page-wrapper` hides the global footer + adjusts main height so the
  // chat fills the viewport cleanly (same treatment as /agent/chat).
  return <div className="chat-page-wrapper">{children}</div>;
}
