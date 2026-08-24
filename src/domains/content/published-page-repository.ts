import "server-only";

import { unstable_cache } from "next/cache";

import type {
  ContentEntryDto,
  ContentRevisionDto,
  ContentTranslationDto,
} from "@/domains/content/persistence";
import {
  MongoContentRepository,
  MongoLocalizedRouteRepository,
} from "@/domains/content/persistence";
import { getLocalizedRouteModel } from "@/domains/content/persistence/models";
import { requireMongoPublicDataSource } from "@/lib/data-source";
import { locales, type Locale } from "@/lib/i18n/config";

export type PublishedPageRouteDto = {
  locale: Locale;
  path: string;
};

export type PublishedPageDto = {
  entry: ContentEntryDto;
  revision: ContentRevisionDto;
  translation: ContentTranslationDto;
  routes: readonly PublishedPageRouteDto[];
};

const contentRepository = new MongoContentRepository();
const routeRepository = new MongoLocalizedRouteRepository();

async function queryPublishedPage(
  locale: Locale,
  path: string,
): Promise<PublishedPageDto | null> {
  const route = await routeRepository.findActive(locale, path);
  if (!route || route.entityType !== "content") return null;

  const [entry, revision, translation] = await Promise.all([
    contentRepository.findEntryById(route.entityId),
    contentRepository.findRevisionById(route.versionId),
    contentRepository.findTranslation(route.versionId, locale),
  ]);

  if (
    !entry ||
    entry.status !== "published" ||
    entry.currentPublishedRevisionId !== route.versionId ||
    !revision ||
    revision.status !== "published" ||
    !translation ||
    translation.translationStatus !== "published"
  ) {
    return null;
  }

  const siblingRoutes = await getLocalizedRouteModel()
    .find({
      entityType: "content",
      entityId: route.entityId,
      versionId: route.versionId,
      active: true,
      locale: { $in: locales },
    })
    .select("locale path -_id")
    .lean<Array<{ locale: Locale; path: string }>>()
    .exec();

  return {
    entry,
    revision,
    translation,
    routes: siblingRoutes.map(({ locale: routeLocale, path: routePath }) => ({
      locale: routeLocale,
      path: routePath,
    })),
  };
}

const cachedPublishedPage = unstable_cache(
  queryPublishedPage,
  ["published-content-page-by-route-v1"],
  { revalidate: 3_600, tags: ["content:public"] },
);

export async function getPublishedPageByRoute(
  locale: Locale,
  path: string,
): Promise<PublishedPageDto | null> {
  if (!requireMongoPublicDataSource()) return null;
  return cachedPublishedPage(locale, path);
}
