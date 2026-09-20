import "server-only";

import { mongoAuditRepository } from "@/domains/audit/mongo-repository";
import { mongoApprovalRepository } from "@/domains/approvals/mongo-repository";
import { approvalService } from "@/domains/approvals/runtime";
import {
  materialsFacilityLookup,
  mongoApprovalHistoryReader,
  mongoFacilityContractStore,
  mongoFacilityPaymentStore,
} from "@/domains/facility-contracts/persistence/mongo-store";
import { FacilityContractService } from "@/domains/facility-contracts/service";
import { mongoOrderStore } from "@/domains/orders/persistence/mongo-store";

export const facilityContractService = new FacilityContractService({
  contractStore: mongoFacilityContractStore,
  paymentStore: mongoFacilityPaymentStore,
  facilityLookup: materialsFacilityLookup,
  orderStore: mongoOrderStore,
  approvalRepository: mongoApprovalRepository,
  approvalService,
  approvalHistory: mongoApprovalHistoryReader,
  auditRepository: mongoAuditRepository,
});
