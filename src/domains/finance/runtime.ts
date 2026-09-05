import "server-only";

import { mongoAuditRepository } from "@/domains/audit/mongo-repository";
import { mongoCustomerStore } from "@/domains/customers/persistence/mongo-store";
import { FxRateService } from "@/domains/finance/fx-service";
import { InvoiceCommandService } from "@/domains/finance/invoice-service";
import { mongoFxRateStore } from "@/domains/finance/persistence/fx-mongo-store";
import { mongoInvoiceStore } from "@/domains/finance/persistence/invoice-mongo-store";
import { mongoFinanceEntryStore } from "@/domains/finance/persistence/mongo-store";
import { FinanceCommandService } from "@/domains/finance/service";
import { mongoOrderStore } from "@/domains/orders/persistence/mongo-store";
import { mongoSupplierStore } from "@/domains/suppliers/persistence/mongo-store";

export const financeCommandService = new FinanceCommandService({
  store: mongoFinanceEntryStore,
  invoiceStore: mongoInvoiceStore,
  orderStore: mongoOrderStore,
  customerStore: mongoCustomerStore,
  supplierStore: mongoSupplierStore,
  fxRateStore: mongoFxRateStore,
  auditRepository: mongoAuditRepository,
});

export const invoiceCommandService = new InvoiceCommandService({
  store: mongoInvoiceStore,
  orderStore: mongoOrderStore,
  fxRateStore: mongoFxRateStore,
  auditRepository: mongoAuditRepository,
});

export const fxRateService = new FxRateService({
  store: mongoFxRateStore,
  auditRepository: mongoAuditRepository,
});
