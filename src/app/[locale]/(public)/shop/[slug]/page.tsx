import { notFound } from "next/navigation";

import { placeShopOrderAction } from "@/app/[locale]/(public)/shop/[slug]/actions";
import { ShopItemPage } from "@/components/public/pages";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getShopItemPageData } from "@/lib/public/shop-page-data";
import { getShopItemMetadata } from "@/lib/seo/route-metadata";

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
  const data = await getShopItemPageData(locale, dictionary, slug);

  if (!data) {
    notFound();
  }

  return (
    <ShopItemPage
      data={data}
      dictionary={dictionary}
      isDemo={data.contentIsDemo}
      submitOrder={placeShopOrderAction}
    />
  );
}
