import { notFound } from "next/navigation";

import { AboutHistoryPage } from "@/components/public/pages";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getDemoAboutHistoryPageData } from "@/lib/public/demo-page-data";
import { JsonLdScripts } from "@/lib/seo/json-ld";
import { getDemoStaticPageMetadata } from "@/lib/seo/route-metadata";
import { sectionStructuredData } from "@/lib/seo/structured-data";

type AboutRouteProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: AboutRouteProps) {
  const { locale } = await params;
  return getDemoStaticPageMetadata(locale, "about");
}

export default async function AboutRoute({ params }: AboutRouteProps) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const dictionary = await getDictionary(locale);
  const data = await getDemoAboutHistoryPageData(locale, dictionary);

  return (
    <>
      <JsonLdScripts
        documents={sectionStructuredData(locale, dictionary, {
          name: dictionary.nav.about,
          path: "/about",
        })}
      />
      <AboutHistoryPage
        data={data}
        dictionary={dictionary}
        isDemo={data.contentIsDemo}
      />
    </>
  );
}
