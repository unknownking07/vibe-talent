import type { Metadata } from "next";
import { jsonLdHtml } from "@/lib/json-ld";
import { defaultSocialImage, siteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Find a Developer with AI: VibeFinder Bot",
  alternates: {
    canonical: `${siteUrl}/agent`,
  },
  description:
    "Describe your project and find builders by listed technologies and public portfolio evidence. Inspect their work before arranging a paid trial.",
  openGraph: {
    title: "Find a Developer with AI: VibeTalent",
    description: "Describe your project and let VibeFinder Bot match you with the right developer.",
    url: `${siteUrl}/agent`,
    siteName: "VibeTalent",
    type: "website",
    images: [{ url: defaultSocialImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    images: [defaultSocialImage],
    title: "Find a Developer with AI: VibeTalent",
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
      "AI talent matching using public project evidence and listed technologies. Activity rankings are separate from hiring evaluations.",
    url: `${siteUrl}/agent`,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    author: {
      "@type": "Organization",
      name: "VibeTalent",
      url: siteUrl,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(breadcrumbLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(softwareAppLd) }}
      />
      {children}
    </>
  );
}
