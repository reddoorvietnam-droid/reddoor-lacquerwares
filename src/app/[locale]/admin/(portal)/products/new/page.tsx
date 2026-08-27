import { notFound } from "next/navigation";

import { ProductEditor } from "@/components/admin/product-editor";
import { collectionCommandService } from "@/domains/collections/runtime";
import { ContentAccessDeniedError, requireContentPermission } from "@/lib/auth";
import { isLocale } from "@/lib/i18n/config";
import { resolveAdminLocale } from "@/lib/i18n/admin";

export const dynamic = "force-dynamic";

export default async function NewProductPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: requestedLocale } = await params;
  if (!isLocale(requestedLocale)) notFound();
  const locale = resolveAdminLocale(requestedLocale);

  // Rendering the form is a read; the create itself is re-authorized by the
  // save action. An access context is bound to exactly one permission, so the
  // collections listing must run on a read-bound context.
  let context;
  try {
    context = await requireContentPermission("content.read");
  } catch (error) {
    if (error instanceof ContentAccessDeniedError) notFound();
    throw error;
  }

  const collections = await collectionCommandService.list(context, {});

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
        productId: null,
        status: "draft",
        hasDraft: false,
        sku: "",
        collectionIds: [],
        materials: "",
        colors: "",
        finishes: "",
        leadTimeDays: "",
        dimensions: { length: "", width: "", height: "", unit: "cm" },
        images: [],
        translations: {},
      }}
    />
  );
}
