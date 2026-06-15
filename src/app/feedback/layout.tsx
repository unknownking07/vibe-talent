import type { Metadata } from "next";

// Churn/exit survey reached via /feedback?u=<username> — a utility form, not a
// content page. noindex keeps it out of search; follow lets any links still
// pass equity (the page is a client component and can't export metadata, so
// the robots policy lives here).
export const metadata: Metadata = {
  title: "Feedback",
  robots: { index: false, follow: true },
};

export default function FeedbackLayout({ children }: { children: React.ReactNode }) {
  return children;
}
