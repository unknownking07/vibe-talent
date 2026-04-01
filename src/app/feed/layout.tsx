import type { Metadata } from "next";
import { siteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Live Feed — See What Builders Are Shipping",
  description: "Real-time GitHub activity from vibe coders on VibeTalent. Watch developers push code, ship projects, merge PRs, and maintain their coding streaks.",
  openGraph: {
    title: "Live Feed — VibeTalent",
    description: "Real-time GitHub activity from vibe coders. Watch developers push code, ship projects, and maintain coding streaks.",
    url: `${siteUrl}/feed`,
    siteName: "VibeTalent",
    type: "website",
    images: [
      {
        url: `${siteUrl}/og-image.jpg`,
        width: 1200,
        height: 630,
        alt: "VibeTalent Live Feed",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Live Feed — VibeTalent",
    description: "Real-time GitHub activity from vibe coders. Watch developers push code, ship projects, and maintain coding streaks.",
  },
  alternates: {
    canonical: `${siteUrl}/feed`,
  },
  keywords: [
    "developer activity feed",
    "github activity",
    "vibe coding",
    "coding streaks",
    "developer marketplace",
    "shipped projects",
    "open source contributions",
    "proof of work developers",
  ],
};

export default function FeedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Feed", item: `${siteUrl}/feed` },
    ],
  };

  const collectionLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Live Network Feed",
    description: "Real-time GitHub activity from vibe coders on VibeTalent",
    url: `${siteUrl}/feed`,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionLd) }}
      />
      {children}
    </>
  );
}
