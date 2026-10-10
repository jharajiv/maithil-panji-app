import type { MetadataRoute } from "next";
import { isStaging } from "@/lib/env";
import { siteUrl } from "@/lib/site";

/** public pages may be found; accounts, trees, shared views, admin and the API may not */
export default function robots(): MetadataRoute.Robots {
  if (isStaging()) return { rules: [{ userAgent: "*", disallow: "/" }] }; // the test copy must never appear in search results
  return {
    rules: [{ userAgent: "*", allow: ["/", "/about", "/faq", "/sample", "/privacy"], disallow: ["/api/", "/app", "/admin", "/build", "/join/", "/view/", "/login", "/tree"] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
    host: siteUrl(),
  };
}
