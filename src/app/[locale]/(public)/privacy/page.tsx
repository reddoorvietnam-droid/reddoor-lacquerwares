import { notFound } from "next/navigation";

import { PrivacyPage } from "@/components/public/pages";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getLegalDocumentPageData } from "@/lib/public/demo-page-data";
import { getDemoStaticPageMetadata } from "@/lib/seo/route-metadata";

type PrivacyRouteProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PrivacyRouteProps) {
  const { locale } = await params;
  return getDemoStaticPageMetadata(locale, "privacy");
}

export default async function PrivacyRoute({ params }: PrivacyRouteProps) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const dictionary = await getDictionary(locale);
  const data = getLegalDocumentPageData(locale, dictionary, "privacy");

  return <PrivacyPage data={data} dictionary={dictionary} isDemo={false} />;
}
