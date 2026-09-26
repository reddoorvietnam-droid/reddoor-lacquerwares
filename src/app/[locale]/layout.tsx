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
 * character that lets the headings carry their tight negative tracking. Be
 * Vietnam Pro is drawn for Vietnamese, which is the same concern one level
 * down.
 *
 * Neither has CJK glyphs, so the Japanese and Chinese fallbacks stay in the
 * stacks in `globals.css` and must not be removed.
 *
 * `subsets` only controls which files get a `<link rel="preload">`: every
 * subset's @font-face rule (latin-ext included) is still self-hosted and
 * fetched on demand through its unicode-range, so a rare Ÿ or Ỹ still renders
 * in the web font after one late swap. Preloading latin + vietnamese covers
 * every string in the six dictionaries.
 */
const displayFont = Playfair({
  subsets: ["latin", "vietnamese"],
  // Static 400 normal + italic, no variable axes: this cuts the preloaded
  // Playfair bytes from ~513 KB (ital + opsz + wght) to ~150 KB, which was
  // the biggest LCP cost on mobile. No public component sets a serif weight
  // other than 400, and Playfair then renders at its default optical size.
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-display-loaded",
});

const bodyFont = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
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
    // The home page's own meta description (≤160 code points); the longer
    // `meta.siteDescription` stays on the OG card, JSON-LD and the manifest.
    description: dictionary.meta.pageDescriptions.home,
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
    verification: siteVerification(),
  };
}

/**
 * Ownership tokens for Google Search Console and Bing Webmaster Tools, set
 * from the environment so a token can change without a code release.
 */
function siteVerification(): Metadata["verification"] {
  const google = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim();
  const bing = process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION?.trim();

  if (!google && !bing) return undefined;

  return {
    ...(google ? { google } : {}),
    ...(bing ? { other: { "msvalidate.01": bing } } : {}),
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
      {/*
        suppressHydrationWarning: browser extensions (Grammarly and the like)
        inject data-* attributes into <body> before React hydrates, which is
        outside our control and harmless. Suppression is attribute-level only —
        child-content mismatches still surface.
      */}
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
