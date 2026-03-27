import type { MetadataRoute } from "next";

const siteUrl = "https://www.vibetalent.work";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/dashboard/"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
