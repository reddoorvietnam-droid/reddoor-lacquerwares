import { notFound } from "next/navigation";

import { SearchPage } from "@/components/public/pages";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getDemoSearchPageData } from "@/lib/public/demo-page-data";
import { getDemoStaticPageMetadata } from "@/lib/seo/route-metadata";

type SearchRouteProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    q?: string | string[];
    scope?: string | string[];
  }>;
};

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export async function generateMetadata({ params }: SearchRouteProps) {
  const { locale } = await params;
  return getDemoStaticPageMetadata(locale, "search", false);
}

export default async function SearchRoute({
  params,
  searchParams,
}: SearchRouteProps) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);

  if (!isLocale(locale)) {
    notFound();
  }

  const dictionary = await getDictionary(locale);
  const data = await getDemoSearchPageData(locale, dictionary, {
    query: firstValue(query.q),
    scope: firstValue(query.scope),
  });

  return <SearchPage data={data} dictionary={dictionary} isDemo />;
}
