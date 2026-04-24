import type { Metadata } from "next";

// Canonical site URL — always use www; Vercel redirects non-www with 307 which breaks social media crawlers
export const siteUrl = "https://www.vibetalent.work";
const siteName = "VibeTalent";

/**
 * Env-overridable site URL for server code (emails, API manifests, cron fan-out)
 * that may run under a preview/staging origin.
 *
 * Validates NEXT_PUBLIC_SITE_URL: trims whitespace, requires http(s) protocol
 * and a hostname, and returns .origin (strips trailing slash/path). Falls back
 * to the canonical siteUrl on any parse failure or invalid input, so a mis-set
 * env var can never leak garbage into outbound emails or JSON manifests.
 */
export function getSiteUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!envUrl) return siteUrl;
  try {
    const parsed = new URL(envUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return siteUrl;
    if (!parsed.hostname) return siteUrl;
    return parsed.origin;
  } catch {
    return siteUrl;
  }
}

export type BreadcrumbItem = { name: string; path: string };

/**
 * Build a Schema.org BreadcrumbList JSON-LD object. Use standalone with
 * `"@context": "https://schema.org"`, or embed inside an "@graph" array.
 * `path` of "/" resolves to the bare siteUrl (no trailing slash).
 */
export function buildBreadcrumbList(items: BreadcrumbItem[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.path === "/" ? siteUrl : `${siteUrl}${item.path}`,
    })),
  };
}

export function createMetadata(options: {
  title: string;
  description: string;
  path?: string;
  image?: string;
}): Metadata {
  const { title, description, path = "", image } = options;
  const fullTitle = `${title} | ${siteName}`;
  const url = `${siteUrl}${path}`;
  const ogImage = image || `${siteUrl}/og-image-v2.jpg`;

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
      images: [{ url: ogImage, width: 1200, height: 630, alt: fullTitle }],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [ogImage],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}
