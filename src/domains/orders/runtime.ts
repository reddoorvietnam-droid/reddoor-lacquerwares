import "server-only";

import { mongoAuditRepository } from "@/domains/audit/mongo-repository";
import { mongoApprovalRepository } from "@/domains/approvals/mongo-repository";
import { approvalService } from "@/domains/approvals/runtime";
import { mongoOrderStore } from "@/domains/orders/persistence/mongo-store";
import { OrderCommandService } from "@/domains/orders/service";

export const orderCommandService = new OrderCommandService({
  store: mongoOrderStore,
  approvalRepository: mongoApprovalRepository,
  approvalService,
  auditRepository: mongoAuditRepository,
});
