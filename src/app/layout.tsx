import type { Metadata, Viewport } from "next";
import "./globals.css";
import { StagingBanner } from "@/components/StagingBanner";
import { RefCapture } from "@/components/RefCapture";
import { Analytics } from "@/components/Analytics";
import { ConsentBanner } from "@/components/ConsentBanner";
import { ldJson } from "@/lib/jsonld";
import { isStaging } from "@/lib/env";
import { ORG_LONG, ORG_NAME, siteUrl, TAGLINE } from "@/lib/site";

const DESCRIPTION = `${TAGLINE} A free community project of ${ORG_NAME} (${ORG_LONG}), built around the Panji Prabandh tradition.`;

export const metadata: Metadata = {
  ...(isStaging() ? { robots: { index: false, follow: false } } : {}),
  metadataBase: new URL(siteUrl()),
  title: { default: `${ORG_NAME} — Maithil family trees`, template: `%s` },
  description: DESCRIPTION,
  applicationName: ORG_NAME,
  publisher: ORG_NAME,
  keywords: ["Maithil", "Mithila", "Panji", "Panji Prabandh", "Panjikar", "family tree", "vanshavali", "gotra", "mool", "genealogy", "PAAG Foundation"],
  /* search engines: tell Google and Bing this site is yours (set the two values in Vercel; nothing shows on the page) */
  verification: { ...(process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : {}), ...(process.env.BING_SITE_VERIFICATION ? { other: { "msvalidate.01": process.env.BING_SITE_VERIFICATION } } : {}) },
  openGraph: { type: "website", siteName: ORG_NAME, title: `${ORG_NAME} — build your Maithil family tree`, description: DESCRIPTION },
  twitter: { card: "summary_large_image", title: `${ORG_NAME} — build your Maithil family tree`, description: DESCRIPTION },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  /* on Android the keyboard shrinks the page (the answer box stays visible) instead of covering it */
  interactiveWidget: "resizes-content",
  themeColor: "#1f2a5c",
};

/** other places that show the same organisation (comma-separated links in NEXT_PUBLIC_SAME_AS: Facebook page, YouTube, X ...), so search engines and AI assistants connect them */
const sameAs = (process.env.NEXT_PUBLIC_SAME_AS ?? "").split(",").map((x) => x.trim()).filter((x) => /^https:\/\//.test(x));

/** tells search engines and AI assistants who stands behind the site and what the site is */
const orgJson = ldJson({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization", "@id": `${siteUrl()}/#org`,
      name: ORG_NAME, alternateName: [ORG_LONG, "PAAG"], url: siteUrl(), sameAs,
      logo: `${siteUrl()}/brand/paag-mark-512.png`,
      description: `${ORG_NAME} (${ORG_LONG}) is a community initiative helping Maithil families record their lineage in the Panji Prabandh tradition.`,
      brand: { "@type": "Brand", name: ORG_NAME, url: siteUrl() },
    },
    { "@type": "WebSite", "@id": `${siteUrl()}/#site`, url: siteUrl(), name: ORG_NAME, inLanguage: ["en", "hi"], publisher: { "@id": `${siteUrl()}/#org` }, description: TAGLINE },
  ],
});

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <StagingBanner />
        <RefCapture />
        <Analytics />
        {children}
        <ConsentBanner />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: orgJson }} />
      </body>
    </html>
  );
}
