import { notFound } from "next/navigation";
import { requirePaintAccess } from "@/domains/paint-warehouse/access";
import { ContentAccessDeniedError } from "@/lib/auth/authorization";
import { PaintWarehouse } from "@/components/admin/paint-warehouse/paint-warehouse";
import { isLocale } from "@/lib/i18n/config";
export const dynamic = "force-dynamic";
export default async function PaintWarehousePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  if (!isLocale((await params).locale)) notFound();
  try {
    await requirePaintAccess("read");
  } catch (error) {
    if (error instanceof ContentAccessDeniedError) notFound();
    throw error;
  }
  return <PaintWarehouse />;
}
