import type { MetadataRoute } from "next";

import { locales } from "@/lib/i18n/config";
import { absoluteUrl, getSiteUrl } from "@/lib/seo/urls";

export function buildRobots(siteUrl: URL = getSiteUrl()): MetadataRoute.Robots {
  const localizedSearchRoutes = locales.flatMap((locale) => [
    `/${locale}/search`,
    `/${locale}/search/`,
  ]);
  const localizedPrivateRoutes = locales.flatMap((locale) => [
    `/${locale}/private`,
    `/${locale}/private/`,
  ]);

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/admin/",
        "/api",
        "/api/",
        "/auth",
        "/auth/",
        "/private",
        "/private/",
        ...localizedSearchRoutes,
        ...localizedPrivateRoutes,
      ],
    },
    sitemap: absoluteUrl("/sitemap.xml", siteUrl),
  };
}
