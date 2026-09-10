import { notFound } from "next/navigation";
import { requireMaterialsAccess } from "@/domains/materials/access";
import { ContentAccessDeniedError } from "@/lib/auth/authorization";
import { MaterialsWorkspace } from "@/components/admin/materials/materials-workspace";
import { isLocale } from "@/lib/i18n/config";

export const dynamic = "force-dynamic";

/** Nguyên vật liệu: one screen, four tabs (?tab=summary|inbound|outbound|catalog). */
export default async function MaterialsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  if (!isLocale((await params).locale)) notFound();
  try {
    await requireMaterialsAccess("read");
  } catch (error) {
    if (error instanceof ContentAccessDeniedError) notFound();
    throw error;
  }
  return <MaterialsWorkspace />;
}
