import { notFound } from "next/navigation";

import { placeShopOrderAction } from "@/app/[locale]/(public)/shop/[slug]/actions";
import { ShopItemPage } from "@/components/public/pages";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getPublicShopRepository } from "@/lib/public/repositories";
import { getShopItemPageData } from "@/lib/public/shop-page-data";
import { JsonLdScripts } from "@/lib/seo/json-ld";
import { getShopItemMetadata } from "@/lib/seo/route-metadata";
import { shopItemStructuredData } from "@/lib/seo/structured-data";

const shopRepository = getPublicShopRepository();

type ShopItemRouteProps = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: ShopItemRouteProps) {
  const { locale, slug } = await params;
  return getShopItemMetadata(locale, slug);
}

export default async function ShopItemRoute({ params }: ShopItemRouteProps) {
  const { locale, slug } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const dictionary = await getDictionary(locale);
  const [data, item] = await Promise.all([
    getShopItemPageData(locale, dictionary, slug),
    shopRepository.getBySlug(locale, slug),
  ]);

  if (!data || !item) {
    notFound();
  }

  return (
    <>
      <JsonLdScripts
        documents={shopItemStructuredData(locale, dictionary, item)}
        enabled={!data.contentIsDemo}
      />
      <ShopItemPage
        data={data}
        dictionary={dictionary}
        isDemo={data.contentIsDemo}
        submitOrder={placeShopOrderAction}
      />
    </>
  );
}
