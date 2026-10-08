import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ORG_LONG, ORG_NAME, SITE_NAME, siteUrl, TAGLINE } from "@/lib/site";

const DESCRIPTION = `${TAGLINE} A free community project of ${ORG_NAME} (${ORG_LONG}), built around the Panji Prabandh tradition.`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: `${SITE_NAME} — Family Tree by ${ORG_NAME}`, template: `%s` },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  publisher: ORG_NAME,
  keywords: ["Maithil", "Mithila", "Panji", "Panji Prabandh", "Panjikar", "family tree", "vanshavali", "gotra", "mool", "genealogy", "PAAG Foundation"],
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: `${SITE_NAME} · ${ORG_NAME}`, title: `${SITE_NAME} — build your Maithil family tree`, description: DESCRIPTION, url: "/" },
  twitter: { card: "summary_large_image", title: `${SITE_NAME} — build your Maithil family tree`, description: DESCRIPTION },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1f2a5c",
};

/** tells search engines who stands behind the site */
const orgJson = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "Organization",
  name: ORG_NAME,
  alternateName: [ORG_LONG, "PAAG"],
  url: siteUrl(),
  sameAs: [],
  description: `${ORG_NAME} (${ORG_LONG}) is a community initiative helping Maithil families record their lineage in the Panji Prabandh tradition.`,
  brand: { "@type": "Brand", name: SITE_NAME, url: siteUrl() },
}).replace(/</g, "\\u003c");

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: orgJson }} />
      </body>
    </html>
  );
}
