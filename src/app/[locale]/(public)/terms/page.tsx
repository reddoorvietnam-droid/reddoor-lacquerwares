import { notFound } from "next/navigation";

import { TermsPage } from "@/components/public/pages";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getLegalDocumentPageData } from "@/lib/public/demo-page-data";
import { getDemoStaticPageMetadata } from "@/lib/seo/route-metadata";

type TermsRouteProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: TermsRouteProps) {
  const { locale } = await params;
  return getDemoStaticPageMetadata(locale, "terms");
}

export default async function TermsRoute({ params }: TermsRouteProps) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const dictionary = await getDictionary(locale);
  const data = getLegalDocumentPageData(locale, dictionary, "terms");

  return <TermsPage data={data} dictionary={dictionary} isDemo={false} />;
}
