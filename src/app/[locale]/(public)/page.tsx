import { notFound } from "next/navigation";

import { HomePage } from "@/components/public/home-page";
import { demoCollectionRepository } from "@/domains/collections/demo-repository";
import { demoContentRepository } from "@/domains/content/demo-repository";
import { demoNewsRepository } from "@/domains/news/demo-repository";
import { demoProductRepository } from "@/domains/products/demo-repository";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";

type HomeRouteProps = {
  params: Promise<{ locale: string }>;
};

export default async function HomeRoute({ params }: HomeRouteProps) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const [dictionary, content, products, collections, news] = await Promise.all([
    getDictionary(locale),
    demoContentRepository.getSnapshot(locale),
    demoProductRepository.list(locale, { featuredOnly: true, limit: 3 }),
    demoCollectionRepository.list(locale, { featuredOnly: true, limit: 3 }),
    demoNewsRepository.list(locale, { featuredOnly: true, limit: 3 }),
  ]);

  return (
    <HomePage
      locale={locale}
      dictionary={dictionary}
      content={content}
      products={products}
      collections={collections}
      news={news}
    />
  );
}
