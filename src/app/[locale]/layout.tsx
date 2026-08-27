import type { Metadata } from "next";
import { Be_Vietnam_Pro, Playfair } from "next/font/google";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import "@/app/globals.css";
import { isLocale, localeConfig, locales } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { buildPublicMetadata } from "@/lib/seo/metadata";

/*
 * The site ran on a system-font stack, which meant the display face resolved
 * to Book Antiqua on Windows and Palatino on macOS — two faces that read as
 * word-processor default rather than as a brand. These are self-hosted by
 * `next/font`, so there is no request to Google and no layout shift.
 *
 * Playfair — not Playfair Display, which was tried first and rejected: it
 * stacks a Vietnamese tone mark straight onto the circumflex below it, so
 * `ề` and `ố` fused into a single blob at display size. Playfair positions
 * the second mark clear of the first, keeps the same wide high-contrast
 * character that lets the headings carry their tight negative tracking, and
 * adds an optical-size axis. Be Vietnam Pro is drawn for Vietnamese, which is
 * the same concern one level down.
 *
 * Neither has CJK glyphs, so the Japanese and Chinese fallbacks stay in the
 * stacks in `globals.css` and must not be removed.
 */
const displayFont = Playfair({
  subsets: ["latin", "latin-ext", "vietnamese"],
  style: ["normal", "italic"],
  // Kept so the browser can pick the display cut by itself at heading sizes;
  // without the axis, font-optical-sizing has nothing to act on.
  axes: ["opsz"],
  display: "swap",
  variable: "--font-display-loaded",
});

const bodyFont = Be_Vietnam_Pro({
  subsets: ["latin", "latin-ext", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-body-loaded",
});

type LocaleLayoutProps = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: LocaleLayoutProps): Promise<Metadata> {
  const { locale } = await params;

  if (!isLocale(locale)) {
    return {};
  }

  const dictionary = await getDictionary(locale);
  const metadata = buildPublicMetadata({
    locale,
    title: dictionary.meta.siteTitle,
    description: dictionary.meta.siteDescription,
    siteName: dictionary.meta.siteName,
    // The public copy is approved; marking it DEMO here forced `noindex` on
    // every localized route.
    isDemo: false,
  });

  return {
    ...metadata,
    title: {
      default: dictionary.meta.siteTitle,
      // The template appends the brand alone. Appending the full site title
      // produced three-part tabs such as "About | Red Door | Living Lacquer",
      // which truncate before the page name is readable.
      template: `%s | ${dictionary.meta.siteName}`,
    },
    applicationName: "Red Door Lacquerwares",
    ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
      ? {
          verification: {
            google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
          },
        }
      : {}),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  return (
    <html
      lang={locale}
      dir={localeConfig[locale].direction}
      className={`${displayFont.variable} ${bodyFont.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
