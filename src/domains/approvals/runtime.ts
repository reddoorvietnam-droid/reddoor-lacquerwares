import "server-only";

import { mongoAuditRepository } from "@/domains/audit/mongo-repository";
import { mongoApprovalRepository } from "@/domains/approvals/mongo-repository";
import { ApprovalService } from "@/domains/approvals/service";

export const approvalService = new ApprovalService({
  repository: mongoApprovalRepository,
  auditRepository: mongoAuditRepository,
});
