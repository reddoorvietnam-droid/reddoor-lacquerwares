import { notFound } from "next/navigation";

import {
  ProductEditor,
  type GalleryImage,
  type ProductEditorTranslation,
} from "@/components/admin/product-editor";
import { collectionCommandService } from "@/domains/collections/runtime";
import type { ProductTranslationDto } from "@/domains/products/persistence/dto";
import { productCommandService } from "@/domains/products/runtime";
import { ContentAccessDeniedError, requireContentPermission } from "@/lib/auth";
import { blocksToEditorText, blocksToLines } from "@/lib/content/editor-text";
import { findImagesForEntities } from "@/lib/media/entity-images";
import { CloudinaryMediaStorage } from "@/lib/media/cloudinary-storage";
import { isLocale } from "@/lib/i18n/config";
import { resolveAdminLocale } from "@/lib/i18n/admin";

export const dynamic = "force-dynamic";

function toEditorTranslation(
  translation: ProductTranslationDto,
): ProductEditorTranslation {
  return {
    title: translation.title,
    slug: translation.slug,
    shortDescription: translation.shortDescription ?? "",
    descriptionText: blocksToEditorText(translation.description),
    careText: blocksToLines(translation.careInstructions),
    seoTitle: translation.seo.title ?? "",
    seoDescription: translation.seo.description ?? "",
    noIndex: translation.seo.noIndex,
  };
}

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ locale: string; productId: string }>;
}) {
  const { locale: requestedLocale, productId } = await params;
  if (!isLocale(requestedLocale)) notFound();
  if (!/^[a-f0-9]{24}$/.test(productId)) notFound();
  const locale = resolveAdminLocale(requestedLocale);

  let context;
  try {
    context = await requireContentPermission("content.read");
  } catch (error) {
    if (error instanceof ContentAccessDeniedError) notFound();
    throw error;
  }

  const [aggregate, collections] = await Promise.all([
    productCommandService.read(context, { productId }),
    collectionCommandService.list(context, {}),
  ]);
  if (!aggregate) notFound();

  const bundle = aggregate.draft ?? aggregate.published;
  const translations: Partial<Record<"vi" | "en", ProductEditorTranslation>> =
    {};
  for (const translation of bundle?.translations ?? []) {
    if (translation.locale === "vi" || translation.locale === "en") {
      translations[translation.locale] = toEditorTranslation(translation);
    }
  }

  const version = bundle?.version;
  const dimensions = version?.dimensions ?? null;

  const imagesByEntity = await findImagesForEntities("product", [productId]);
  let storage: CloudinaryMediaStorage | null = null;
  try {
    storage = CloudinaryMediaStorage.fromEnvironment();
  } catch {
    storage = null;
  }
  const images: GalleryImage[] = (imagesByEntity.get(productId) ?? []).map(
    (image) => ({
      publicId: image.publicId,
      assetVersion: image.assetVersion,
      width: image.width,
      height: image.height,
      bytes: 1,
      previewUrl: storage
        ? storage.buildImageUrl(image.publicId, image.assetVersion, 320)
        : "",
    }),
  );

  return (
    <ProductEditor
      locale={locale}
      collectionOptions={collections.items.map((item) => ({
        id: item.collection.id,
        title:
          item.draftTranslations.find(({ locale: l }) => l === "vi")?.title ??
          item.draftTranslations[0]?.title ??
          item.publishedTranslations[0]?.title ??
          item.collection.code,
      }))}
      initial={{
        productId,
        status: aggregate.product.status,
        hasDraft: aggregate.draft !== null,
        sku: aggregate.product.sku,
        collectionIds: aggregate.product.collectionIds,
        group: aggregate.product.group,
        isAvailable: aggregate.product.isAvailable,
        categoryKey: aggregate.product.categoryKey,
        materials: (version?.materials ?? []).join(", "),
        colors: (version?.colors ?? []).join(", "),
        finishes: (version?.finishes ?? []).join(", "),
        leadTimeDays:
          version?.leadTimeDays !== null && version?.leadTimeDays !== undefined
            ? String(version.leadTimeDays)
            : "",
        dimensions: {
          length: dimensions?.length ?? "",
          width: dimensions?.width ?? "",
          height: dimensions?.height ?? "",
          unit: dimensions?.unit === "mm" ? "mm" : "cm",
        },
        images,
        translations,
      }}
    />
  );
}
