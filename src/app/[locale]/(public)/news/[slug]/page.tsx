import type { Route } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import { NewsArticlePage } from "@/components/public/pages";
import { isLocale, localePath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import {
  getDemoNewsArticlePageData,
  getDemoNewsStaticParams,
} from "@/lib/public/demo-page-data";
import { getPublicNewsRepository } from "@/lib/public/repositories";
import { JsonLdScripts } from "@/lib/seo/json-ld";
import { getDemoNewsMetadata } from "@/lib/seo/route-metadata";
import { articleStructuredData } from "@/lib/seo/structured-data";
import { encodeSeoSlug } from "@/lib/seo/urls";

const newsRepository = getPublicNewsRepository();

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

  const article = await newsRepository.getBySlug(locale, slug);
  if (!article) {
    notFound();
  }
  // The URL carried another language's slug (the locale switcher keeps the
  // slug); send visitors and crawlers to this locale's own address.
  if (article.slug !== slug) {
    permanentRedirect(
      localePath(locale, `/news/${encodeSeoSlug(article.slug)}`) as Route,
    );
  }

  const dictionary = await getDictionary(locale);
  const data = await getDemoNewsArticlePageData(locale, dictionary, slug);

  if (!data) {
    notFound();
  }

  return (
    <>
      <JsonLdScripts
        documents={articleStructuredData(locale, dictionary, article)}
        enabled={!article.isDemo}
      />
      <NewsArticlePage
        data={data}
        dictionary={dictionary}
        isDemo={data.contentIsDemo}
      />
    </>
  );
}
