import "server-only";

import { mongoAuditRepository } from "@/domains/audit/mongo-repository";
import { mongoCustomerStore } from "@/domains/customers/persistence/mongo-store";
import { CustomerCommandService } from "@/domains/customers/service";

export const customerCommandService = new CustomerCommandService({
  store: mongoCustomerStore,
  auditRepository: mongoAuditRepository,
});
