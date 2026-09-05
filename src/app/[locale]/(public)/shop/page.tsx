import { notFound } from "next/navigation";

import { ShopListingPage } from "@/components/public/pages";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getShopListingPageData } from "@/lib/public/shop-page-data";
import { getDemoStaticPageMetadata } from "@/lib/seo/route-metadata";

type ShopRouteProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: ShopRouteProps) {
  const { locale } = await params;
  return getDemoStaticPageMetadata(locale, "shop");
}

export default async function ShopRoute({ params }: ShopRouteProps) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const dictionary = await getDictionary(locale);
  const data = await getShopListingPageData(locale, dictionary);

  return (
    <ShopListingPage
      data={data}
      dictionary={dictionary}
      isDemo={data.contentIsDemo}
    />
  );
}
