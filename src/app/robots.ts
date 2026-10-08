import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

/** public pages may be found; accounts, trees, shared views, admin and the API may not */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: ["/", "/about", "/sample", "/privacy"], disallow: ["/api/", "/app", "/admin", "/build", "/join/", "/view/", "/login", "/tree"] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
    host: siteUrl(),
  };
}
