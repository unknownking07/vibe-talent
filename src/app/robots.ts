import type { MetadataRoute } from "next";

const siteUrl = "https://www.vibetalent.work";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/dashboard/",
          "/settings/",
          "/admin/",
          "/auth/forgot-password",
          "/auth/reset-password",
          "/auth/profile-setup",
          "/hire/chat/",
        ],
      },
      { userAgent: "GPTBot", allow: "/" },
      { userAgent: "ChatGPT-User", allow: "/" },
      { userAgent: "Google-Extended", allow: "/" },
      { userAgent: "ClaudeBot", allow: "/" },
      { userAgent: "PerplexityBot", allow: "/" },
      { userAgent: "CCBot", allow: "/" },
      { userAgent: "OAI-SearchBot", allow: "/" },
      { userAgent: "Bingbot", allow: "/" },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
