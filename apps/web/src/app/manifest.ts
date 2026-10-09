import type { MetadataRoute } from "next";

import { SITE_NAME } from "@/lib/seo";

/**
 * The installable app's identity. Before this file existed the home-screen tile fell back to
 * the first letter of the page title, a large "B" from "Bible", and the name was whatever the
 * platform scraped. The icon is the jot and its tittle in `public/icon.svg`, rendered to PNG at
 * the sizes Android and iOS ask for; the maskable variant keeps the mark inside the safe zone.
 * Colours are `--color-brand` and `--color-bg` from globals.css, converted from oklch and
 * recorded beside the tokens in the SVG.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: "Read the Bible closely: translations, apparatus, cross-references, the original words and a timeline of the evidence.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fbf6ee",
    theme_color: "#14655d",
    lang: "en",
    categories: ["books", "education", "reference"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
