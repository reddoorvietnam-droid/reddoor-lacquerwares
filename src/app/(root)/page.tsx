import type { Route } from "next";
import { permanentRedirect } from "next/navigation";

import { defaultLocale } from "@/lib/i18n/config";

/**
 * The bare domain always opens the default locale. The redirect is permanent
 * (308) so search engines treat `/${defaultLocale}` as the home page and pass
 * links pointing at the bare domain on to it.
 */
export default function RootPage(): never {
  permanentRedirect(`/${defaultLocale}` as Route);
}
