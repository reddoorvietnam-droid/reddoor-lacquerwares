import { notFound } from "next/navigation";

import { ShopItemEditor } from "@/components/admin/shop-item-editor";
import {
  ContentAccessDeniedError,
  requirePermission,
  resolvePermissionCoverages,
} from "@/lib/auth";
import { isLocale } from "@/lib/i18n/config";
import { resolveAdminLocale } from "@/lib/i18n/admin";

export const dynamic = "force-dynamic";

export default async function NewShopItemPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: requestedLocale } = await params;
  if (!isLocale(requestedLocale)) notFound();
  const locale = resolveAdminLocale(requestedLocale);

  try {
    await requirePermission("shop.manage");
  } catch (error) {
    if (error instanceof ContentAccessDeniedError) notFound();
    throw error;
  }
  const coverage = await resolvePermissionCoverages(["shop.publish"]);

  return (
    <ShopItemEditor
      locale={locale}
      initial={{
        itemId: null,
        revision: null,
        status: "draft",
        slug: "",
        priceVnd: "",
        priceUsd: "",
        stockQuantity: "0",
        sortOrder: "0",
        images: [],
        text: {
          vi: { name: "", summary: "", description: "" },
          en: { name: "", summary: "", description: "" },
        },
        canPublish: coverage["shop.publish"].global,
      }}
    />
  );
}
