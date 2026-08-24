import { notFound } from "next/navigation";

import { ProductDetailPage } from "@/components/public/pages";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import {
  getDemoProductDetailPageData,
  getDemoProductStaticParams,
} from "@/lib/public/demo-page-data";
import { getDemoProductMetadata } from "@/lib/seo/route-metadata";

type ProductDetailRouteProps = {
  params: Promise<{ locale: string; slug: string }>;
};

export function generateStaticParams() {
  return getDemoProductStaticParams();
}

export async function generateMetadata({ params }: ProductDetailRouteProps) {
  const { locale, slug } = await params;
  return getDemoProductMetadata(locale, slug);
}

export default async function ProductDetailRoute({
  params,
}: ProductDetailRouteProps) {
  const { locale, slug } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const dictionary = await getDictionary(locale);
  const data = await getDemoProductDetailPageData(locale, dictionary, slug);

  if (!data) {
    notFound();
  }

  return <ProductDetailPage data={data} dictionary={dictionary} isDemo />;
}
