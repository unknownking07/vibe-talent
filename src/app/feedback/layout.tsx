import type { Metadata } from "next";

// Churn/exit survey reached via /feedback?u=<username> — a utility form, not a
// content page. Keep it out of search results (the page itself is a client
// component and can't export metadata, so the noindex lives here).
export const metadata: Metadata = {
  title: "Feedback",
  robots: { index: false, follow: false },
};

export default function FeedbackLayout({ children }: { children: React.ReactNode }) {
  return children;
}
