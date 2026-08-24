import { notFound } from "next/navigation";

import { CollectionLandingPage } from "@/components/public/pages";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import {
  getDemoCollectionLandingPageData,
  getDemoCollectionStaticParams,
} from "@/lib/public/demo-page-data";
import { getDemoCollectionMetadata } from "@/lib/seo/route-metadata";

type CollectionDetailRouteProps = {
  params: Promise<{ locale: string; slug: string }>;
};

export function generateStaticParams() {
  return getDemoCollectionStaticParams();
}

export async function generateMetadata({ params }: CollectionDetailRouteProps) {
  const { locale, slug } = await params;
  return getDemoCollectionMetadata(locale, slug);
}

export default async function CollectionDetailRoute({
  params,
}: CollectionDetailRouteProps) {
  const { locale, slug } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const dictionary = await getDictionary(locale);
  const data = await getDemoCollectionLandingPageData(locale, dictionary, slug);

  if (!data) {
    notFound();
  }

  return <CollectionLandingPage data={data} dictionary={dictionary} isDemo />;
}
