import type { Route } from "next";
import { notFound } from "next/navigation";
import {
  hasSalesSlipAccess,
  requireSalesSlipAccess,
} from "@/domains/sales-slips/access";
import { idSchema, SalesSlipError } from "@/domains/sales-slips/contracts";
import { readSlip } from "@/domains/sales-slips/service";
import { ContentAccessDeniedError } from "@/lib/auth/authorization";
import { PrintToolbar } from "@/components/admin/sales-slips/print-toolbar";
import { SalesSlipSheet } from "@/components/admin/sales-slips/sales-slip-sheet";
import { isLocale } from "@/lib/i18n/config";

export const dynamic = "force-dynamic";

/** Print preview: the slip as the Excel form prints it, and nothing else on paper. */
export default async function SalesSlipPrintPage({
  params,
}: {
  params: Promise<{ locale: string; slipId: string }>;
}) {
  const { locale, slipId } = await params;
  if (!isLocale(locale) || !idSchema.safeParse(slipId).success) notFound();
  let canReadPrice = false;
  let canExport = false;
  try {
    await requireSalesSlipAccess("print");
    [canReadPrice, canExport] = await Promise.all([
      hasSalesSlipAccess("readPrice"),
      hasSalesSlipAccess("export"),
    ]);
  } catch (error) {
    if (error instanceof ContentAccessDeniedError) notFound();
    throw error;
  }
  let slip;
  try {
    ({ slip } = await readSlip(slipId, canReadPrice));
  } catch (error) {
    if (error instanceof SalesSlipError && error.status === 404) notFound();
    throw error;
  }
  return (
    <div>
      <PrintToolbar
        slipId={slipId}
        backHref={`/${locale}/admin/sales-slips/${slipId}` as Route}
        capabilities={{ print: true, export: canExport }}
      />
      <SalesSlipSheet slip={slip} />
    </div>
  );
}
