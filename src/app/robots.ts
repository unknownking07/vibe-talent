import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";

const privateDisallow = [
  "/api/",
  "/dashboard",
  "/settings",
  "/admin",
  "/auth/",
  "/hire/chat/",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: privateDisallow,
      },
      { userAgent: "GPTBot", allow: "/", disallow: privateDisallow },
      { userAgent: "ChatGPT-User", allow: "/", disallow: privateDisallow },
      { userAgent: "Google-Extended", allow: "/", disallow: privateDisallow },
      { userAgent: "ClaudeBot", allow: "/", disallow: privateDisallow },
      { userAgent: "PerplexityBot", allow: "/", disallow: privateDisallow },
      { userAgent: "CCBot", allow: "/", disallow: privateDisallow },
      { userAgent: "OAI-SearchBot", allow: "/", disallow: privateDisallow },
      { userAgent: "Bingbot", allow: "/", disallow: privateDisallow },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
