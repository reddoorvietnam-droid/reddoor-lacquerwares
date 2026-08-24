import { notFound } from "next/navigation";

import { LacquerProcessPage } from "@/components/public/pages";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getDemoLacquerProcessPageData } from "@/lib/public/demo-page-data";
import { getDemoStaticPageMetadata } from "@/lib/seo/route-metadata";

type ProcessRouteProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: ProcessRouteProps) {
  const { locale } = await params;
  return getDemoStaticPageMetadata(locale, "process");
}

export default async function ProcessRoute({ params }: ProcessRouteProps) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const dictionary = await getDictionary(locale);
  const data = await getDemoLacquerProcessPageData(locale, dictionary);

  return <LacquerProcessPage data={data} dictionary={dictionary} isDemo />;
}
