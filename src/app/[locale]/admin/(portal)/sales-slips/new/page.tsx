import { notFound } from "next/navigation";
import { requireSalesSlipAccess } from "@/domains/sales-slips/access";
import { ContentAccessDeniedError } from "@/lib/auth/authorization";
import { SalesSlipDetail } from "@/components/admin/sales-slips/sales-slip-detail";
import { isLocale } from "@/lib/i18n/config";

export const dynamic = "force-dynamic";

/** A new Phiếu bán hàng; the draft is created on the first autosave. */
export default async function NewSalesSlipPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  try {
    await requireSalesSlipAccess("create");
  } catch (error) {
    if (error instanceof ContentAccessDeniedError) notFound();
    throw error;
  }
  return (
    <SalesSlipDetail basePath={`/${locale}/admin/sales-slips`} slipId={null} />
  );
}
