import { notFound } from "next/navigation";

import { AccessibilityPage } from "@/components/public/pages";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getLegalDocumentPageData } from "@/lib/public/demo-page-data";
import { getDemoStaticPageMetadata } from "@/lib/seo/route-metadata";

type AccessibilityRouteProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: AccessibilityRouteProps) {
  const { locale } = await params;
  return getDemoStaticPageMetadata(locale, "accessibility");
}

export default async function AccessibilityRoute({
  params,
}: AccessibilityRouteProps) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const dictionary = await getDictionary(locale);
  const data = getLegalDocumentPageData(locale, dictionary, "accessibility");

  return <AccessibilityPage data={data} dictionary={dictionary} isDemo={false} />;
}
