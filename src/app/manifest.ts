import type { MetadataRoute } from "next";

import { defaultLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";

/**
 * Web app manifest: the name, icon and colours browsers and Android show when
 * the site is saved to a home screen. Written in the default locale, which is
 * also where `start_url` lands.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const dictionary = await getDictionary(defaultLocale);

  return {
    name: dictionary.meta.siteTitle,
    short_name: dictionary.meta.siteName,
    description: dictionary.meta.siteDescription,
    lang: defaultLocale,
    start_url: `/${defaultLocale}`,
    scope: "/",
    display: "standalone",
    // --warm-ivory and --lacquer-red in globals.css.
    background_color: "#f5f0e7",
    theme_color: "#8a171b",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
