import "server-only";

import { mongoAuditRepository } from "@/domains/audit/mongo-repository";
import { mongoCustomerStore } from "@/domains/customers/persistence/mongo-store";
import { mongoInvoiceStore } from "@/domains/finance/persistence/invoice-mongo-store";
import { mongoFinanceEntryStore } from "@/domains/finance/persistence/mongo-store";
import { mongoOrderStore } from "@/domains/orders/persistence/mongo-store";
import { sheetCheckLimits } from "@/domains/sheet-checks/limits";
import { mongoSheetCheckStore } from "@/domains/sheet-checks/persistence/mongo-store";
import { SheetCheckService } from "@/domains/sheet-checks/service";
import { getNotificationEnv } from "@/lib/env/server";

/**
 * Retention of checked results, from `SHEET_CHECK_RETENTION_DAYS` (days,
 * clamped to the allowed range) or the built-in default. Read here rather
 * than in the shared env module so the feature stays self-contained.
 */
export function retentionDaysFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const raw = env.SHEET_CHECK_RETENTION_DAYS?.trim() ?? "";
  if (!/^\d{1,4}$/.test(raw)) return sheetCheckLimits.checkedRetentionDays;
  const days = Number.parseInt(raw, 10);
  return Math.min(
    sheetCheckLimits.maxRetentionDays,
    Math.max(sheetCheckLimits.minRetentionDays, days),
  );
}

export const sheetCheckService = new SheetCheckService({
  store: mongoSheetCheckStore,
  orderStore: mongoOrderStore,
  invoiceStore: mongoInvoiceStore,
  financeEntryStore: mongoFinanceEntryStore,
  customerStore: mongoCustomerStore,
  auditRepository: mongoAuditRepository,
  timeZone: getNotificationEnv().BUSINESS_TIMEZONE,
  checkedRetentionDays: retentionDaysFromEnv(),
});
