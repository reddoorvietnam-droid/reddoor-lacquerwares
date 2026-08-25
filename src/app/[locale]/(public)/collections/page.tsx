import { notFound } from "next/navigation";

import { CollectionListingPage } from "@/components/public/pages";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getDemoCollectionListingPageData } from "@/lib/public/demo-page-data";
import { getDemoStaticPageMetadata } from "@/lib/seo/route-metadata";

type CollectionsRouteProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: CollectionsRouteProps) {
  const { locale } = await params;
  return getDemoStaticPageMetadata(locale, "collections");
}

export default async function CollectionsRoute({
  params,
}: CollectionsRouteProps) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const dictionary = await getDictionary(locale);
  const data = await getDemoCollectionListingPageData(locale, dictionary);

  return (
    <CollectionListingPage
      data={data}
      dictionary={dictionary}
      isDemo={data.contentIsDemo}
    />
  );
}
