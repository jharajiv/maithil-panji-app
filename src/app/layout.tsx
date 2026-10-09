import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ORG_LONG, ORG_NAME, siteUrl, TAGLINE } from "@/lib/site";

const DESCRIPTION = `${TAGLINE} A free community project of ${ORG_NAME} (${ORG_LONG}), built around the Panji Prabandh tradition.`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: `${ORG_NAME} — Maithil family trees`, template: `%s` },
  description: DESCRIPTION,
  applicationName: ORG_NAME,
  publisher: ORG_NAME,
  keywords: ["Maithil", "Mithila", "Panji", "Panji Prabandh", "Panjikar", "family tree", "vanshavali", "gotra", "mool", "genealogy", "PAAG Foundation"],
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: ORG_NAME, title: `${ORG_NAME} — build your Maithil family tree`, description: DESCRIPTION, url: "/" },
  twitter: { card: "summary_large_image", title: `${ORG_NAME} — build your Maithil family tree`, description: DESCRIPTION },
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
  brand: { "@type": "Brand", name: ORG_NAME, url: siteUrl() },
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
