import type { MetadataRoute } from "next";
import { isStaging } from "@/lib/env";
import { gotraPages, moolPages } from "@/lib/refpages";
import { siteUrl } from "@/lib/site";

/** the day the public pages last changed in a way a search engine should notice; update it when their wording changes */
export const CONTENT_UPDATED = new Date("2026-10-12");

export default function sitemap(): MetadataRoute.Sitemap {
  if (isStaging()) return [];
  const b = siteUrl();
  const at = (path: string, priority: number, changeFrequency: "weekly" | "monthly" | "yearly", extra?: Partial<MetadataRoute.Sitemap[number]>) =>
    ({ url: `${b}${path}`, lastModified: CONTENT_UPDATED, changeFrequency, priority, ...extra });
  const faqLangs = { languages: { en: `${b}/faq`, hi: `${b}/hi/faq`, "x-default": `${b}/faq` } };
  return [
    at("", 1, "weekly"),
    at("/about", 0.6, "monthly"),
    at("/faq", 0.7, "monthly", { alternates: faqLangs }),
    at("/hi/faq", 0.7, "monthly", { alternates: faqLangs }),
    at("/sample", 0.6, "monthly"),
    at("/gotra", 0.7, "monthly"),
    at("/mool", 0.7, "monthly"),
    at("/privacy", 0.3, "yearly"),
    ...gotraPages().map((g) => at(`/gotra/${g.slug}`, 0.5, "yearly")),
    ...moolPages().map((m) => at(`/mool/${m.slug}`, 0.4, "yearly")),
  ];
}
