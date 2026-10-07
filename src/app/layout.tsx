import type { Metadata, Viewport } from "next";
import "./globals.css";

/** the public address, used to turn preview-image paths into full links. Set NEXT_PUBLIC_SITE_URL once the domain is live. */
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Maithil Panji — Family Tree",
  description: "Preserve your Maithil ancestry. Build a tree. Join the lineage.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1f2a5c",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
