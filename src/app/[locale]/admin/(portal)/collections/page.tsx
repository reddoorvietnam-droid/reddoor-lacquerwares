import { notFound } from "next/navigation";

import { CollectionsManager } from "@/components/admin/collections-manager";
import { findCataloguesForCollections } from "@/domains/collections/catalogue";
import { collectionCommandService } from "@/domains/collections/runtime";
import { ContentAccessDeniedError, requireContentPermission } from "@/lib/auth";
import { getCloudinaryEnv } from "@/lib/env/server";
import { CloudinaryMediaStorage } from "@/lib/media/cloudinary-storage";
import { isLocale } from "@/lib/i18n/config";
import { resolveAdminLocale } from "@/lib/i18n/admin";

export const dynamic = "force-dynamic";

/**
 * The collections manager: create a collection, attach its catalogue PDF,
 * publish it. The list is the command-side view (drafts included), so an
 * editor sees the whole pipeline, not just what the public sees.
 */
export default async function AdminCollectionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: requestedLocale } = await params;
  if (!isLocale(requestedLocale)) notFound();
  const locale = resolveAdminLocale(requestedLocale);

  let context;
  try {
    context = await requireContentPermission("content.read");
  } catch (error) {
    if (error instanceof ContentAccessDeniedError) notFound();
    throw error;
  }

  const listing = await collectionCommandService.list(context, {});
  const catalogues = await findCataloguesForCollections(
    listing.items.map(({ collection }) => collection.id),
    "vi",
  );

  // Thumbnails are provider URLs built server-side; the client receives
  // finished strings and nothing about how they are minted.
  let storage: CloudinaryMediaStorage | null = null;
  let maxUploadMb = 10;
  try {
    storage = CloudinaryMediaStorage.fromEnvironment();
    maxUploadMb = getCloudinaryEnv().MAX_PDF_UPLOAD_MB;
  } catch {
    storage = null;
  }

  const rows = listing.items.map(
    ({ collection, draftTranslations, publishedTranslations }) => {
      const translation =
        draftTranslations.find((entry) => entry.locale === "vi") ??
        draftTranslations[0] ??
        publishedTranslations[0] ??
        null;
      const catalogue = catalogues.get(collection.id) ?? null;

      return {
        id: collection.id,
        title: translation?.title ?? collection.code,
        slug: translation?.slug ?? collection.code,
        year: collection.year ?? null,
        status: collection.status,
        translationStatus: translation?.translationStatus ?? null,
        publishedLocales: publishedTranslations.map(({ locale: l }) => l),
        pageCount: catalogue?.pageCount ?? null,
        coverUrl:
          catalogue && storage
            ? storage.buildPageImageUrl({
                publicId: catalogue.publicId,
                pageNumber: 1,
                width: 320,
                version: catalogue.assetVersion,
              })
            : null,
      };
    },
  );

  return (
    <CollectionsManager
      locale={locale}
      rows={rows}
      uploadReady={storage !== null}
      maxUploadMb={maxUploadMb}
    />
  );
}
