import { notFound } from "next/navigation";

import { HomePage } from "@/components/public/home-page";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { JsonLdScripts } from "@/lib/seo/json-ld";
import { getDemoStaticPageMetadata } from "@/lib/seo/route-metadata";
import { homeStructuredData } from "@/lib/seo/structured-data";
import {
  getPublicCollectionRepository,
  getPublicContentRepository,
  getPublicNewsRepository,
  getPublicProductRepository,
} from "@/lib/public/repositories";

const collectionRepository = getPublicCollectionRepository();
const contentRepository = getPublicContentRepository();
const newsRepository = getPublicNewsRepository();
const productRepository = getPublicProductRepository();

type HomeRouteProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: HomeRouteProps) {
  const { locale } = await params;
  return getDemoStaticPageMetadata(locale, "home");
}

export default async function HomeRoute({ params }: HomeRouteProps) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const [dictionary, content, products, collections, news] = await Promise.all([
    getDictionary(locale),
    contentRepository.getSnapshot(locale),
    productRepository.list(locale, { featuredOnly: true, limit: 3 }),
    collectionRepository.list(locale, { featuredOnly: true, limit: 3 }),
    newsRepository.list(locale, { featuredOnly: true, limit: 3 }),
  ]);

  return (
    <>
      <JsonLdScripts
        documents={homeStructuredData(locale, dictionary, content)}
        enabled={!content.isDemo}
      />
      <HomePage
        locale={locale}
        dictionary={dictionary}
        content={content}
        products={products}
        collections={collections}
        news={news}
      />
    </>
  );
}
