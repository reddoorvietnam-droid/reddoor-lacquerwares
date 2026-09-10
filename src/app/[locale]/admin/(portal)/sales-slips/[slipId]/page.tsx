import { notFound } from "next/navigation";
import { requireSalesSlipAccess } from "@/domains/sales-slips/access";
import { idSchema } from "@/domains/sales-slips/contracts";
import { ContentAccessDeniedError } from "@/lib/auth/authorization";
import { SalesSlipDetail } from "@/components/admin/sales-slips/sales-slip-detail";
import { isLocale } from "@/lib/i18n/config";

export const dynamic = "force-dynamic";

/** One Phiếu bán hàng: editable while a draft, read-only afterwards. */
export default async function SalesSlipPage({
  params,
}: {
  params: Promise<{ locale: string; slipId: string }>;
}) {
  const { locale, slipId } = await params;
  if (!isLocale(locale) || !idSchema.safeParse(slipId).success) notFound();
  try {
    await requireSalesSlipAccess("read");
  } catch (error) {
    if (error instanceof ContentAccessDeniedError) notFound();
    throw error;
  }
  return (
    <SalesSlipDetail
      basePath={`/${locale}/admin/sales-slips`}
      slipId={slipId}
    />
  );
}
