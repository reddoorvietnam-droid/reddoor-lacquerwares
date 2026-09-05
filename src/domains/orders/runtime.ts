import "server-only";

import { mongoAuditRepository } from "@/domains/audit/mongo-repository";
import { mongoApprovalRepository } from "@/domains/approvals/mongo-repository";
import { approvalService } from "@/domains/approvals/runtime";
import { mongoCustomerStore } from "@/domains/customers/persistence/mongo-store";
import { mongoOrderStore } from "@/domains/orders/persistence/mongo-store";
import { OrderCommandService } from "@/domains/orders/service";

export const orderCommandService = new OrderCommandService({
  store: mongoOrderStore,
  customerStore: mongoCustomerStore,
  approvalRepository: mongoApprovalRepository,
  approvalService,
  auditRepository: mongoAuditRepository,
});
