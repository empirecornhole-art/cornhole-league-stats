import type { MetadataRoute } from "next";
import { SITE_URL } from "../lib/site";

// /api/data, /api/media and /api/recaps stay crawlable on purpose: the League
// page loads its content from them, and Googlebot needs them to render it.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api/admin/", "/api/cron/", "/api/webhooks/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
