import type { Route } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import { ProductDetailPage } from "@/components/public/pages";
import { isLocale, localePath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import {
  getDemoProductDetailPageData,
  getDemoProductStaticParams,
} from "@/lib/public/demo-page-data";
import { getPublicProductRepository } from "@/lib/public/repositories";
import { JsonLdScripts } from "@/lib/seo/json-ld";
import { getDemoProductMetadata } from "@/lib/seo/route-metadata";
import { productStructuredData } from "@/lib/seo/structured-data";
import { encodeSeoSlug } from "@/lib/seo/urls";

const productRepository = getPublicProductRepository();

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

  const product = await productRepository.getBySlug(locale, slug);
  if (!product) {
    notFound();
  }
  // The URL carried another language's slug (the locale switcher keeps the
  // slug); send visitors and crawlers to this locale's own address.
  if (product.slug !== slug) {
    permanentRedirect(
      localePath(locale, `/products/${encodeSeoSlug(product.slug)}`) as Route,
    );
  }

  const dictionary = await getDictionary(locale);
  const data = await getDemoProductDetailPageData(locale, dictionary, slug);

  if (!data) {
    notFound();
  }

  return (
    <>
      <JsonLdScripts
        documents={productStructuredData(locale, dictionary, product)}
        enabled={!product.isDemo}
      />
      <ProductDetailPage
        data={data}
        dictionary={dictionary}
        isDemo={data.contentIsDemo}
      />
    </>
  );
}
