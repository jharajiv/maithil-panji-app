import type { Metadata } from "next";
import { ORG_NAME } from "./site";

/**
 * Adds the "share" tags (Facebook, WhatsApp, X, LinkedIn) to a page's title and description, with the page's own address and the site's picture.
 * Without this, a page would inherit the home page's address in its share tags.
 */
export function withSocial(m: Metadata & { title: string; description: string }, path: string, locale = "en_IN"): Metadata {
  return {
    ...m,
    openGraph: { type: "website", siteName: ORG_NAME, title: m.title, description: m.description, url: path, locale, images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: `${ORG_NAME} — Maithil family tree` }] },
    twitter: { card: "summary_large_image", title: m.title, description: m.description, images: ["/opengraph-image"] },
  };
}
