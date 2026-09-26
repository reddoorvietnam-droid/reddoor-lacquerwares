import type { Metadata, Route } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import { CollectionLandingPage } from "@/components/public/pages";
import { isLocale, localePath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getCollectionLandingPageData } from "@/lib/public/demo-page-data";
import { getPublicCollectionRepository } from "@/lib/public/repositories";
import { JsonLdScripts } from "@/lib/seo/json-ld";
import { getCollectionLandingMetadata } from "@/lib/seo/route-metadata";
import { collectionStructuredData } from "@/lib/seo/structured-data";
import { encodeSeoSlug } from "@/lib/seo/urls";

// Read from the CMS on every request, like the reader beside it: a publish
// must show at once, and the repositories already cache their queries.
export const dynamic = "force-dynamic";

/**
 * The landing page of one published collection: title, edition, cover, the
 * editorial copy, the link into the flipbook reader when a catalogue is
 * attached, and the products that belong to the collection. It is the
 * collection's canonical address and exists whether or not a catalogue has
 * been uploaded yet, so no published collection is ever unreachable.
 */

type CollectionLandingRouteProps = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({
  params,
}: CollectionLandingRouteProps): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  return getCollectionLandingMetadata(locale, slug);
}

export default async function CollectionLandingRoute({
  params,
}: CollectionLandingRouteProps) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();

  const collection = await getPublicCollectionRepository().getBySlug(
    locale,
    slug,
  );
  if (!collection) notFound();
  // The URL carried another language's slug (the locale switcher keeps the
  // slug); send visitors and crawlers to this locale's own address.
  if (collection.slug !== slug) {
    permanentRedirect(
      localePath(
        locale,
        `/collections/${encodeSeoSlug(collection.slug)}`,
      ) as Route,
    );
  }

  const dictionary = await getDictionary(locale);
  const data = await getCollectionLandingPageData(
    locale,
    dictionary,
    collection,
  );

  return (
    <>
      <JsonLdScripts
        documents={collectionStructuredData(locale, dictionary, collection)}
        enabled={!collection.isDemo}
      />
      <CollectionLandingPage
        data={data}
        dictionary={dictionary}
        isDemo={data.contentIsDemo}
      />
    </>
  );
}
