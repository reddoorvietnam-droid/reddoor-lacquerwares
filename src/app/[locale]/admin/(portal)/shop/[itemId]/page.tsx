import { notFound } from "next/navigation";

import {
  ShopItemEditor,
  type ShopEditorImage,
} from "@/components/admin/shop-item-editor";
import { shopService } from "@/domains/shop/runtime";
import {
  ContentAccessDeniedError,
  requirePermission,
  resolvePermissionCoverages,
} from "@/lib/auth";
import { CloudinaryMediaStorage } from "@/lib/media/cloudinary-storage";
import { isLocale } from "@/lib/i18n/config";
import { resolveAdminLocale } from "@/lib/i18n/admin";

export const dynamic = "force-dynamic";

export default async function EditShopItemPage({
  params,
}: {
  params: Promise<{ locale: string; itemId: string }>;
}) {
  const { locale: requestedLocale, itemId } = await params;
  if (!isLocale(requestedLocale)) notFound();
  if (!/^[a-f0-9]{24}$/.test(itemId)) notFound();
  const locale = resolveAdminLocale(requestedLocale);

  let context;
  try {
    context = await requirePermission("shop.read");
  } catch (error) {
    if (error instanceof ContentAccessDeniedError) notFound();
    throw error;
  }

  const [item, coverage] = await Promise.all([
    shopService.readItem(context, itemId),
    resolvePermissionCoverages(["shop.publish"]),
  ]);
  if (!item) notFound();

  let storage: CloudinaryMediaStorage | null = null;
  try {
    storage = CloudinaryMediaStorage.fromEnvironment();
  } catch {
    storage = null;
  }
  const images: ShopEditorImage[] = item.images.map((image) => ({
    publicId: image.publicId,
    assetVersion: image.assetVersion,
    width: image.width,
    height: image.height,
    bytes: image.bytes,
    previewUrl: storage
      ? storage.buildImageUrl(image.publicId, image.assetVersion, 320)
      : "",
  }));

  return (
    <ShopItemEditor
      locale={locale}
      initial={{
        itemId: item.id,
        revision: item.revision,
        status: item.status,
        slug: item.slug,
        priceVnd: item.priceVnd,
        priceUsd: item.priceUsd,
        stockQuantity: String(item.stockQuantity),
        sortOrder: String(item.sortOrder),
        images,
        text: item.text,
        canPublish: coverage["shop.publish"].global,
      }}
    />
  );
}
