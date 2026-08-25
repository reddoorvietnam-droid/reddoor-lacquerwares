import { notFound } from "next/navigation";

import { NewsListingPage } from "@/components/public/pages";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getDemoNewsListingPageData } from "@/lib/public/demo-page-data";
import { getDemoStaticPageMetadata } from "@/lib/seo/route-metadata";

type NewsRouteProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ category?: string | string[] }>;
};

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export async function generateMetadata({
  params,
  searchParams,
}: NewsRouteProps) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  return getDemoStaticPageMetadata(
    locale,
    "news",
    firstValue(query.category).trim().length === 0,
  );
}

export default async function NewsRoute({
  params,
  searchParams,
}: NewsRouteProps) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);

  if (!isLocale(locale)) {
    notFound();
  }

  const dictionary = await getDictionary(locale);
  const data = await getDemoNewsListingPageData(locale, dictionary, {
    category: firstValue(query.category),
  });

  return (
    <NewsListingPage
      data={data}
      dictionary={dictionary}
      isDemo={data.contentIsDemo}
    />
  );
}
