import { notFound } from "next/navigation";

import { ProductListingPage } from "@/components/public/pages";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getDemoProductListingPageData } from "@/lib/public/demo-page-data";
import { getDemoStaticPageMetadata } from "@/lib/seo/route-metadata";

type ProductsRouteProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    available?: string | string[];
    category?: string | string[];
    collection?: string | string[];
    group?: string | string[];
    page?: string | string[];
    q?: string | string[];
    sort?: string | string[];
  }>;
};

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export async function generateMetadata({
  params,
  searchParams,
}: ProductsRouteProps) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const hasFilters = Object.values(query).some((value) =>
    Array.isArray(value)
      ? value.some((item) => item.trim().length > 0)
      : Boolean(value?.trim()),
  );

  return getDemoStaticPageMetadata(locale, "products", !hasFilters);
}

export default async function ProductsRoute({
  params,
  searchParams,
}: ProductsRouteProps) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);

  if (!isLocale(locale)) {
    notFound();
  }

  const dictionary = await getDictionary(locale);
  const data = await getDemoProductListingPageData(locale, dictionary, {
    available: firstValue(query.available),
    category: firstValue(query.category),
    collection: firstValue(query.collection),
    group: firstValue(query.group),
    page: firstValue(query.page),
    query: firstValue(query.q),
    sort: firstValue(query.sort),
  });

  return (
    <ProductListingPage
      data={data}
      dictionary={dictionary}
      isDemo={data.contentIsDemo}
    />
  );
}
