import { notFound } from "next/navigation";

import { NewsArticlePage } from "@/components/public/pages";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import {
  getDemoNewsArticlePageData,
  getDemoNewsStaticParams,
} from "@/lib/public/demo-page-data";
import { getDemoNewsMetadata } from "@/lib/seo/route-metadata";

type NewsArticleRouteProps = {
  params: Promise<{ locale: string; slug: string }>;
};

export function generateStaticParams() {
  return getDemoNewsStaticParams();
}

export async function generateMetadata({ params }: NewsArticleRouteProps) {
  const { locale, slug } = await params;
  return getDemoNewsMetadata(locale, slug);
}

export default async function NewsArticleRoute({
  params,
}: NewsArticleRouteProps) {
  const { locale, slug } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const dictionary = await getDictionary(locale);
  const data = await getDemoNewsArticlePageData(locale, dictionary, slug);

  if (!data) {
    notFound();
  }

  return <NewsArticlePage data={data} dictionary={dictionary} isDemo />;
}
