import type { MetadataRoute } from "next";
import { ORG_NAME, TAGLINE } from "@/lib/site";

/** lets people add the site to their phone's home screen, where it opens like an app */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: ORG_NAME,
    short_name: "PAAG",
    description: TAGLINE,
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#fbf0d2",
    theme_color: "#1f2a5c",
    lang: "en",
    icons: [
      { src: "/brand/paag-mark-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/paag-mark-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
