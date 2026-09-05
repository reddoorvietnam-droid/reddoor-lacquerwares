import "server-only";

import { mongoAuditRepository } from "@/domains/audit/mongo-repository";
import { mongoSupplierStore } from "@/domains/suppliers/persistence/mongo-store";
import { SupplierCommandService } from "@/domains/suppliers/service";

export const supplierCommandService = new SupplierCommandService({
  store: mongoSupplierStore,
  auditRepository: mongoAuditRepository,
});
