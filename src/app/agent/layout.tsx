import type { Metadata } from "next";
import { siteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Find a Developer with AI — VibeFinder Bot",
  alternates: {
    canonical: `${siteUrl}/agent`,
  },
  description:
    "Use AI to find the perfect vibe coder for your project. Describe what you need and get matched with builders who have the right skills and track record.",
  openGraph: {
    title: "Find a Developer with AI — VibeTalent",
    description: "Describe your project and let VibeFinder Bot match you with the right developer.",
    url: `${siteUrl}/agent`,
    siteName: "VibeTalent",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Find a Developer with AI — VibeTalent",
    description: "Describe your project and let VibeFinder Bot match you with the right developer.",
  },
};

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "AI Agent", item: `${siteUrl}/agent` },
    ],
  };

  const softwareAppLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "VibeFinder Bot",
    description:
      "AI-powered talent matching bot that analyzes builder profiles, coding streaks, and project quality to find the perfect developer for your project.",
    url: `${siteUrl}/agent`,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareAppLd) }}
      />
      {children}
    </>
  );
}
