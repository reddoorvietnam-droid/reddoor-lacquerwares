import { notFound } from "next/navigation";
import { requireSalesSlipAccess } from "@/domains/sales-slips/access";
import { ContentAccessDeniedError } from "@/lib/auth/authorization";
import { SalesSlipList } from "@/components/admin/sales-slips/sales-slip-list";
import { isLocale } from "@/lib/i18n/config";

export const dynamic = "force-dynamic";

/** Hóa đơn bán hàng: the list of every Phiếu bán hàng. */
export default async function SalesSlipsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  try {
    await requireSalesSlipAccess("read");
  } catch (error) {
    if (error instanceof ContentAccessDeniedError) notFound();
    throw error;
  }
  return <SalesSlipList basePath={`/${locale}/admin/sales-slips`} />;
}
