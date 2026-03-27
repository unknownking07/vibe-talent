import type { Metadata } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://vibetalent.work";
const siteName = "VibeTalent";

export function createMetadata(options: {
  title: string;
  description: string;
  path?: string;
}): Metadata {
  const { title, description, path = "" } = options;
  const fullTitle = `${title} | ${siteName}`;
  const url = `${siteUrl}${path}`;

  return {
    title: fullTitle,
    description,
    metadataBase: new URL(siteUrl),
    openGraph: {
      title: fullTitle,
      description,
      url,
      siteName,
      type: "website",
      locale: "en_US",
      images: [
        {
          url: `${siteUrl}/og-image.png`,
          width: 1200,
          height: 630,
          alt: fullTitle,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [`${siteUrl}/og-image.png`],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}
