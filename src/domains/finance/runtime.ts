import "server-only";

import { mongoAuditRepository } from "@/domains/audit/mongo-repository";
import { mongoFinanceEntryStore } from "@/domains/finance/persistence/mongo-store";
import { FinanceCommandService } from "@/domains/finance/service";
import { mongoOrderStore } from "@/domains/orders/persistence/mongo-store";

export const financeCommandService = new FinanceCommandService({
  store: mongoFinanceEntryStore,
  orderStore: mongoOrderStore,
  auditRepository: mongoAuditRepository,
});
