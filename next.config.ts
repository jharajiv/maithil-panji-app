import type { NextConfig } from "next";

const staging = process.env.NEXT_PUBLIC_APP_ENV === "staging" || process.env.VERCEL_ENV === "preview";

const nextConfig: NextConfig = {
  devIndicators: false,
  // the staging copy tells every crawler to stay away, on every address (pages, pictures, files)
  // the old Hindi address /faq?lang=hi now lives at /hi/faq (one address per language, for search engines)
  async redirects() {
    return [{ source: "/faq", has: [{ type: "query" as const, key: "lang", value: "hi" }], destination: "/hi/faq", permanent: true }];
  },
  async headers() {
    return staging ? [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }] }] : [];
  },
};

export default nextConfig;
