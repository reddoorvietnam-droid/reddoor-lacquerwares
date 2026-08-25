import { notFound } from "next/navigation";

import { AboutHistoryPage } from "@/components/public/pages";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getDemoAboutHistoryPageData } from "@/lib/public/demo-page-data";
import { getDemoStaticPageMetadata } from "@/lib/seo/route-metadata";

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
    <AboutHistoryPage
      data={data}
      dictionary={dictionary}
      isDemo={data.contentIsDemo}
    />
  );
}
