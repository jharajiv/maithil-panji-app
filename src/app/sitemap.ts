import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const now = new Date();
  return ["", "/about", "/sample", "/privacy"].map((p, i) => ({ url: `${base}${p}`, lastModified: now, changeFrequency: p === "" ? "weekly" : "monthly", priority: i === 0 ? 1 : 0.6 }));
}
